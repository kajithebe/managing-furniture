// GET /api/reports/overdue (MF-23): the M9 "Not yet returned" tab and its CSV download.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    loanItem: { count: vi.fn(), findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');
const { OVERDUE_CSV_MAX_ROWS } = await import('../src/services/overdueService.js');

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

// Due 9 Nov 14:00 and contacted 10 Nov 10:05 in Helsinki (UTC+2).
const chairRow = {
  id: 31,
  lastContactedAt: new Date('2026-11-10T08:05:00Z'),
  item: {
    code: 'MP-00126',
    name: 'Chair',
    category: { name: 'Chair' },
    currentRoom: D751,
    homeRoom: D569,
  },
  loan: {
    id: 4,
    dueAt: new Date('2026-11-09T12:00:00Z'),
    user: { id: 7, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
  },
};
// Never contacted; a borrower name that starts like a formula must stay text in Excel.
const tableRow = {
  ...chairRow,
  id: 32,
  lastContactedAt: null,
  item: { ...chairRow.item, code: 'MP-02210', name: 'Table', category: { name: 'Table' } },
  loan: { ...chairRow.loan, user: { id: 8, name: '=HYPERLINK("x")', email: 'x@metropolia.fi' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loanItem.findMany.mockResolvedValue([chairRow, tableRow]);
  prisma.loanItem.count.mockResolvedValue(2);
});

const get = (query, role = 'MODERATOR') =>
  request(createApp()).get('/api/reports/overdue').query(query).set('Cookie', loginAs(role));

describe('GET /api/reports/overdue', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/reports/overdue');
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await get({}, 'USER');
    expect(res.status).toBe(403);
    expect(prisma.loanItem.findMany).not.toHaveBeenCalled();
  });

  it('returns the same rows as the M4 list, with the same filters', async () => {
    const res = await get({ category: 3, room: 1, sort: 'borrower', order: 'asc' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toMatchObject({
      code: 'MP-00126',
      borrower: { name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
      lastRoom: D751,
      homeRoom: D569,
    });
    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { status: 'OVERDUE' },
            { item: { categoryId: 3 } },
            { item: { OR: [{ currentRoomId: 1 }, { homeRoomId: 1 }] } },
          ],
        },
        skip: 0,
        take: 25,
      }),
    );
  });

  it('downloads all matching rows as a CSV file in the chosen order', async () => {
    const res = await get({ format: 'csv', page: 3, sort: 'due', order: 'asc' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="?not-yet-returned-\d{4}-\d{2}-\d{2}\.csv"?/,
    );
    // Every row, not only the page that is on the screen.
    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ loan: { dueAt: 'asc' } }, { id: 'asc' }],
        skip: 0,
        take: OVERDUE_CSV_MAX_ROWS,
      }),
    );

    const lines = res.text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines[0]).toBe(
      'Item;Code;Borrower;Email;Due;Hours late;Last known room;Home room;Contacted',
    );
    expect(lines[1]).toMatch(
      /^Chair;MP-00126;Aino Virtanen;aino\.virtanen@metropolia\.fi;2026-11-09 14:00;\d+;D751;D569;2026-11-10 10:05$/,
    );
    // Formula guard from utils/csv.js, quotes doubled; never contacted = empty cell.
    expect(lines[2]).toMatch(/^Table;MP-02210;"'=HYPERLINK\(""x""\)";x@metropolia\.fi;.*;$/);
  });

  it('starts with the BOM, so Excel shows ä and ö correctly', async () => {
    const res = await get({ format: 'csv' });
    expect(res.text.startsWith('\uFEFF')).toBe(true);
  });

  it('rejects unknown formats and sort columns', async () => {
    for (const query of [{ format: 'xlsx' }, { sort: 'email' }]) {
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
