// Loans report (MF-32): the date range in Helsinki time, the "late" rule, the row shape,
// the summary numbers and the CSV.
// The database is mocked, so this runs anywhere, including CI.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    loan: { count: vi.fn(), findMany: vi.fn() },
    loanItem: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { isLate, loansCsv, loansReport, startOfDay } =
  await import('../src/services/reportService.js');

const NOW = new Date('2026-11-20T10:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loan.count.mockResolvedValue(0);
  prisma.loan.findMany.mockResolvedValue([]);
  prisma.loanItem.findMany.mockResolvedValue([]);
  prisma.room.findMany.mockResolvedValue([]);
});

describe('startOfDay', () => {
  it('gives midnight in Helsinki in winter time (UTC+2)', () => {
    expect(startOfDay('2026-11-20', 'Europe/Helsinki')).toEqual(
      new Date('2026-11-19T22:00:00.000Z'),
    );
  });

  it('gives midnight in Helsinki in summer time (UTC+3)', () => {
    expect(startOfDay('2026-07-01', 'Europe/Helsinki')).toEqual(
      new Date('2026-06-30T21:00:00.000Z'),
    );
  });
});

describe('isLate', () => {
  const dueAt = new Date('2026-11-20T12:00:00Z');
  const loan = (...items) => ({ dueAt, items });

  it('is late when an item is not yet returned (OVERDUE)', () => {
    expect(isLate(loan({ status: 'OVERDUE' }), NOW)).toBe(true);
  });

  it('is late when an item is still out after the due time', () => {
    expect(isLate(loan({ status: 'APPROVED' }), new Date('2026-11-20T12:01:00Z'))).toBe(true);
  });

  it('is not late while an item is out before the due time', () => {
    expect(isLate(loan({ status: 'APPROVED' }), NOW)).toBe(false);
  });

  it('is late when an item came back after the due time', () => {
    const returnedAt = new Date('2026-11-20T12:10:00Z');
    expect(isLate(loan({ status: 'RETURNED', returnedAt }), NOW)).toBe(true);
  });

  it('is not late when every item came back on time', () => {
    const returnedAt = new Date('2026-11-20T11:55:00Z');
    expect(isLate(loan({ status: 'RETURNED', returnedAt }), NOW)).toBe(false);
  });

  it('is never late for items that never left (waiting or declined)', () => {
    const later = new Date('2026-11-21T10:00:00Z');
    expect(isLate(loan({ status: 'PENDING' }, { status: 'DECLINED' }), later)).toBe(false);
  });
});

describe('loansReport', () => {
  it('builds one filter from all the chosen filters and pages the results', async () => {
    await loansReport(
      {
        from: '2026-11-01',
        to: '2026-11-30',
        category: 4,
        room: 1,
        status: 'OPEN',
        page: 2,
        pageSize: 25,
      },
      NOW,
    );

    const where = {
      AND: [
        { createdAt: { gte: startOfDay('2026-11-01') } },
        // "to" includes the whole last day: before midnight at the start of the next day.
        { createdAt: { lt: startOfDay('2026-12-01') } },
        { status: 'OPEN' },
        { items: { some: { item: { categoryId: 4 } } } },
        { OR: [{ toRoomId: 1 }, { items: { some: { fromRoomId: 1 } } }] },
      ],
    };
    expect(prisma.loan.count).toHaveBeenCalledWith({ where });
    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 25,
        take: 25,
      }),
    );
  });

  it('uses no filter when nothing is chosen', async () => {
    await loansReport({ page: 1, pageSize: 25 }, NOW);
    expect(prisma.loan.count).toHaveBeenCalledWith({ where: { AND: [] } });
  });

  it('returns one row per loan with rooms, items, last return time and late', async () => {
    prisma.loan.count.mockResolvedValue(1);
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 7,
        createdAt: new Date('2026-11-09T07:58:00Z'),
        dueAt: new Date('2026-11-09T12:00:00Z'),
        closedAt: new Date('2026-11-09T12:10:00Z'),
        status: 'CLOSED',
        reason: 'Group work',
        toRoomId: 2,
        user: { id: 3, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
        items: [
          {
            id: 11,
            status: 'RETURNED',
            fromRoomId: 1,
            returnedAt: new Date('2026-11-09T11:55:00Z'),
            item: { code: 'MP-00123', name: 'Chair', category: { name: 'Chair' } },
          },
          {
            id: 12,
            status: 'RETURNED',
            fromRoomId: 1,
            returnedAt: new Date('2026-11-09T12:10:00Z'),
            item: { code: 'MP-00124', name: 'Chair', category: { name: 'Chair' } },
          },
          {
            id: 13,
            status: 'DECLINED',
            fromRoomId: 5,
            returnedAt: null,
            item: { code: 'MP-02210', name: 'Table', category: { name: 'Table' } },
          },
        ],
      },
    ]);
    prisma.room.findMany.mockResolvedValue([
      { id: 1, name: 'D569' },
      { id: 2, name: 'D751' },
      { id: 5, name: 'D512' },
    ]);

    const result = await loansReport({ page: 1, pageSize: 25 }, NOW);

    expect(result.total).toBe(1);
    expect(result.data).toEqual([
      {
        id: 7,
        createdAt: new Date('2026-11-09T07:58:00Z'),
        borrower: { id: 3, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
        items: [
          { id: 11, code: 'MP-00123', name: 'Chair', category: 'Chair', status: 'RETURNED' },
          { id: 12, code: 'MP-00124', name: 'Chair', category: 'Chair', status: 'RETURNED' },
          { id: 13, code: 'MP-02210', name: 'Table', category: 'Table', status: 'DECLINED' },
        ],
        fromRooms: [
          { id: 1, name: 'D569' },
          { id: 5, name: 'D512' },
        ],
        toRoom: { id: 2, name: 'D751' },
        reason: 'Group work',
        dueAt: new Date('2026-11-09T12:00:00Z'),
        status: 'CLOSED',
        // The last item came back at 12:10, which is also why the loan counts as late.
        returnedAt: new Date('2026-11-09T12:10:00Z'),
        late: true,
      },
    ]);
  });

  it('has no return time while the loan is still open', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 8,
        createdAt: NOW,
        dueAt: new Date('2026-11-20T14:00:00Z'),
        closedAt: null,
        status: 'OPEN',
        reason: 'Exam prep',
        toRoomId: 2,
        user: { id: 3, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
        items: [
          {
            id: 14,
            status: 'RETURNED',
            fromRoomId: 1,
            returnedAt: new Date('2026-11-20T11:00:00Z'),
            item: { code: 'MP-00125', name: 'Chair', category: { name: 'Chair' } },
          },
          {
            id: 15,
            status: 'APPROVED',
            fromRoomId: 1,
            returnedAt: null,
            item: { code: 'MP-00126', name: 'Chair', category: { name: 'Chair' } },
          },
        ],
      },
    ]);

    const [row] = (await loansReport({ page: 1, pageSize: 25 }, NOW)).data;
    expect(row.returnedAt).toBeNull();
    expect(row.late).toBe(false);
  });
});

// A moved loan item as the summary query returns it.
function moved(category, fromRoomId, toRoomId, returnedAt = null) {
  return {
    returnedAt: returnedAt && new Date(returnedAt),
    fromRoomId,
    loan: { dueAt: new Date('2026-11-09T12:00:00Z'), toRoomId },
    item: { category: { name: category } },
  };
}

describe('loansReport summary', () => {
  it('counts only moved items of the matching loans', async () => {
    await loansReport({ status: 'CLOSED', page: 1, pageSize: 25 }, NOW);
    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          loan: { AND: [{ status: 'CLOSED' }] },
          status: { in: ['APPROVED', 'OVERDUE', 'RETURNED'] },
        },
      }),
    );
  });

  it('gives loans, items moved, % on time, top categories and busiest rooms', async () => {
    prisma.loan.count.mockResolvedValue(2);
    prisma.loanItem.findMany.mockResolvedValue([
      moved('Chair', 1, 2, '2026-11-09T11:55:00Z'), // on time
      moved('Chair', 1, 2, '2026-11-09T12:10:00Z'), // late
      moved('Table', 5, 2), // still out: not counted in % on time
    ]);
    prisma.room.findMany.mockResolvedValue([
      { id: 1, name: 'D569' },
      { id: 2, name: 'D751' },
      { id: 5, name: 'D512' },
    ]);

    const { summary } = await loansReport({ page: 1, pageSize: 25 }, NOW);

    expect(summary).toEqual({
      loans: 2,
      itemsMoved: 3,
      onTimePercent: 50,
      topCategories: [
        { name: 'Chair', count: 2 },
        { name: 'Table', count: 1 },
      ],
      // D751 is the target room 3 times, D569 the from-room twice, D512 once.
      busiestRooms: [
        { id: 2, name: 'D751', count: 3 },
        { id: 1, name: 'D569', count: 2 },
        { id: 5, name: 'D512', count: 1 },
      ],
    });
  });

  it('shows no % on time while nothing has been returned', async () => {
    const { summary } = await loansReport({ page: 1, pageSize: 25 }, NOW);
    expect(summary).toEqual({
      loans: 0,
      itemsMoved: 0,
      onTimePercent: null,
      topCategories: [],
      busiestRooms: [],
    });
  });

  it('shows at most 3 categories, biggest first', async () => {
    prisma.loanItem.findMany.mockResolvedValue([
      moved('Sofa', 1, 2),
      moved('Chair', 1, 2),
      moved('Chair', 1, 2),
      moved('Table', 1, 2),
      moved('Stool', 1, 2),
    ]);
    const { summary } = await loansReport({ page: 1, pageSize: 25 }, NOW);
    expect(summary.topCategories).toEqual([
      { name: 'Chair', count: 2 },
      { name: 'Sofa', count: 1 },
      { name: 'Stool', count: 1 },
    ]);
  });
});

describe('loansCsv', () => {
  it('writes every matching loan with times in Helsinki and guards formulas', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 7,
        createdAt: new Date('2026-11-09T07:58:00Z'),
        dueAt: new Date('2026-11-09T12:00:00Z'),
        closedAt: new Date('2026-11-09T12:10:00Z'),
        status: 'CLOSED',
        reason: '=HYPERLINK("http://example.com")',
        toRoomId: 2,
        user: { id: 3, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
        items: [
          {
            id: 11,
            status: 'RETURNED',
            fromRoomId: 1,
            returnedAt: new Date('2026-11-09T12:10:00Z'),
            item: { code: 'MP-00123', name: 'Chair', category: { name: 'Chair' } },
          },
          {
            id: 13,
            status: 'DECLINED',
            fromRoomId: 5,
            returnedAt: null,
            item: { code: 'MP-02210', name: 'Table', category: { name: 'Table' } },
          },
        ],
      },
    ]);
    prisma.room.findMany.mockResolvedValue([
      { id: 1, name: 'D569' },
      { id: 2, name: 'D751' },
      { id: 5, name: 'D512' },
    ]);

    const csv = await loansCsv({ status: 'CLOSED' }, NOW);
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');

    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ status: 'CLOSED' }] }, take: 20000 }),
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(lines).toEqual([
      'Loan date;Borrower;Email;Items;From;To;Reason;Due;Returned at;Late;Status',
      // 07:58 UTC is 09:58 in Helsinki; the reason starts with = so it gets a leading '.
      '2026-11-09 09:58;Aino Virtanen;aino.virtanen@metropolia.fi;' +
        'Chair MP-00123 (Returned), Table MP-02210 (Declined);D569, D512;D751;' +
        '"\'=HYPERLINK(""http://example.com"")";2026-11-09 14:00;2026-11-09 14:10;Yes;Closed',
    ]);
  });
});
