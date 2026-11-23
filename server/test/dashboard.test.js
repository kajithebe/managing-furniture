// GET /api/moderator/dashboard (MF-31): M1 Dashboard for moderators and admins.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    loanItem: { count: vi.fn(), findMany: vi.fn() },
    item: { count: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function loginAs(role) {
  prisma.user.findUnique.mockResolvedValue({
    id: 9,
    email: 'mikko.laine@metropolia.fi',
    name: 'Mikko Laine',
    role,
    active: true,
  });
  return sessionCookie(9);
}

const D569 = { id: 1, name: 'D569' };
const D751 = { id: 2, name: 'D751' };
const aino = { id: 7, name: 'Aino Virtanen' };

// One LoanItem row as Prisma returns it with the dashboard's select.
function loanItemRow(id, code, category, loan) {
  return {
    id,
    item: { code, name: category, category: { name: category }, currentRoom: D751 },
    loan: { id: loan.id, dueAt: loan.dueAt, toRoomId: D751.id, user: aino },
  };
}

const waitingRow = loanItemRow(23, 'MP-02210', 'Table', {
  id: 5,
  dueAt: new Date('2026-11-09T12:00:00Z'),
});
const overdueRow = loanItemRow(31, 'MP-00126', 'Chair', {
  id: 4,
  dueAt: new Date('2026-11-08T12:00:00Z'),
});
const dueTodayRow = loanItemRow(41, 'MP-00123', 'Chair', {
  id: 6,
  dueAt: new Date('2026-11-09T12:00:00Z'),
});

// Each list query returns its own row, picked by the LoanItem status it asks for.
function mockLists() {
  prisma.loanItem.findMany.mockImplementation(({ where }) =>
    Promise.resolve(
      { PENDING: [waitingRow], OVERDUE: [overdueRow], APPROVED: [dueTodayRow] }[where.status],
    ),
  );
  prisma.room.findMany.mockResolvedValue([D569, D751]);
}

// The M1 tiles: 3 waiting, 2 not yet returned, 41 on loan, 9,812 items.
function mockCounts() {
  prisma.loanItem.count.mockImplementation(({ where }) =>
    Promise.resolve(where.status === 'PENDING' ? 3 : 2),
  );
  prisma.item.count.mockImplementation(({ where }) => Promise.resolve(where.onLoan ? 41 : 9812));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCounts();
  mockLists();
});

describe('GET /api/moderator/dashboard', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/moderator/dashboard');
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('USER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it('is for admins too', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('ADMIN'));
    expect(res.status).toBe(200);
  });

  it('returns the four tile counts (M1)', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.body.tiles).toEqual({
      waitingForApproval: 3,
      notYetReturned: 2,
      onLoanNow: 41,
      totalItems: 9812,
    });
    // "Updated 10:15 · Refresh"
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('counts with the right filters', async () => {
    await request(createApp()).get('/api/moderator/dashboard').set('Cookie', loginAs('MODERATOR'));

    expect(prisma.loanItem.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect(prisma.loanItem.count).toHaveBeenCalledWith({ where: { status: 'OVERDUE' } });
    expect(prisma.item.count).toHaveBeenCalledWith({ where: { onLoan: true } });
    // Disposed items are not counted, as in the items list.
    expect(prisma.item.count).toHaveBeenCalledWith({
      where: { condition: { not: 'DISPOSED' } },
    });
  });

  it('returns the waiting, overdue and due-today lists (M1)', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('MODERATOR'));

    // Waiting: "Table MP-02210 · Aino Virtanen · D751 · 14:00", opens Requests.
    expect(res.body.waiting).toEqual([
      {
        id: 23,
        loanId: 5,
        code: 'MP-02210',
        name: 'Table',
        category: 'Table',
        borrower: aino,
        dueAt: '2026-11-09T12:00:00.000Z',
        toRoom: D751,
      },
    ]);
    // Not yet returned: "Chair MP-00126 · Aino Virtanen · 26 h late · D751".
    expect(res.body.overdue).toEqual([
      expect.objectContaining({ id: 31, loanId: 4, code: 'MP-00126', lastRoom: D751 }),
    ]);
    // Due back today: item, borrower, due; the loan id opens the loan detail (M3).
    expect(res.body.dueToday).toEqual([
      expect.objectContaining({ id: 41, loanId: 6, code: 'MP-00123', borrower: aino }),
    ]);
    // M1 shows no email.
    expect(res.body.waiting[0].borrower).not.toHaveProperty('email');
  });

  it('asks for the 5 oldest waiting and the 5 longest overdue items', async () => {
    await request(createApp()).get('/api/moderator/dashboard').set('Cookie', loginAs('MODERATOR'));

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        orderBy: [{ loan: { createdAt: 'asc' } }, { id: 'asc' }],
        take: 5,
      }),
    );
    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OVERDUE' },
        orderBy: [{ loan: { dueAt: 'asc' } }, { id: 'asc' }],
        take: 5,
      }),
    );
  });

  it('due back today: items on loan due between now and midnight in Helsinki', async () => {
    const { getDashboard } = await import('../src/services/dashboardService.js');
    // 9 Nov 2026, 10:15 in Helsinki (UTC+2).
    await getDashboard(new Date('2026-11-09T08:15:00Z'));

    const dueTodayCall = prisma.loanItem.findMany.mock.calls.find(
      ([args]) => args.where.status === 'APPROVED',
    );
    expect(dueTodayCall[0].where.loan.dueAt).toEqual({
      gte: new Date('2026-11-09T08:15:00Z'),
      lt: new Date('2026-11-09T22:00:00Z'), // midnight 10 Nov in Helsinki
    });
  });

  it('empty lists when nothing is waiting, late or due', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);
    prisma.room.findMany.mockResolvedValue([]);
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ waiting: [], overdue: [], dueToday: [] });
  });
});
