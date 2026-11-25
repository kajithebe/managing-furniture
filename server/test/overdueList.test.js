// GET /api/moderator/overdue (MF-23): M4 Not yet returned for moderators and admins.
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
const { hoursLate } = await import('../src/services/overdueService.js');

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
const aino = { id: 7, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' };

// The two M4 rows, as Prisma returns them with the service's select.
const dueAt = new Date('2026-11-09T12:00:00Z');
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
  loan: { id: 4, dueAt, user: aino },
};
const tableRow = {
  ...chairRow,
  id: 32,
  lastContactedAt: null,
  item: { ...chairRow.item, code: 'MP-02210', name: 'Table', category: { name: 'Table' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loanItem.findMany.mockResolvedValue([chairRow, tableRow]);
  // The filtered total (where: { AND: [...] }) and all not yet returned items.
  prisma.loanItem.count.mockImplementation(({ where }) => Promise.resolve(where.AND ? 312 : 314));
});

const get = (query, role = 'MODERATOR') =>
  request(createApp()).get(`/api/moderator/overdue${query}`).set('Cookie', loginAs(role));

describe('GET /api/moderator/overdue', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/moderator/overdue');
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await get('', 'USER');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(prisma.loanItem.findMany).not.toHaveBeenCalled();
  });

  it('is for admins too', async () => {
    const res = await get('', 'ADMIN');
    expect(res.status).toBe(200);
  });

  it('returns one page of M4 rows, the filtered total and the not yet returned count', async () => {
    const res = await get('');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(312);
    expect(res.body.notYetReturned).toBe(314);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      id: 31,
      loanId: 4,
      code: 'MP-00126',
      name: 'Chair',
      category: 'Chair',
      borrower: aino,
      dueAt: dueAt.toISOString(),
      hoursLate: expect.any(Number),
      lastRoom: D751,
      homeRoom: D569,
      lastContactedAt: '2026-11-10T08:05:00.000Z',
    });
    // Never contacted: "—" on M4.
    expect(res.body.data[1].lastContactedAt).toBeNull();
  });

  it('lists only not yet returned items, late the longest first, 25 per page', async () => {
    await get('');

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: 'OVERDUE' }] },
        orderBy: [{ loan: { dueAt: 'asc' } }, { id: 'asc' }],
        skip: 0,
        take: 25,
      }),
    );
    expect(prisma.loanItem.count).toHaveBeenCalledWith({ where: { status: 'OVERDUE' } });
  });

  it('filters by category and by room (last known room or home room)', async () => {
    await get('?category=3&room=1&page=2');

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { status: 'OVERDUE' },
            { item: { categoryId: 3 } },
            { item: { OR: [{ currentRoomId: 1 }, { homeRoomId: 1 }] } },
          ],
        },
        skip: 25,
      }),
    );
  });

  it('sorts by any column, never-contacted items last', async () => {
    await get('?sort=lastContacted&order=asc');

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ lastContactedAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      }),
    );
  });

  it('rejects unknown sort columns and bad ids', async () => {
    for (const query of ['?sort=email', '?room=abc', '?pageSize=500']) {
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('hoursLate', () => {
  it('counts full hours since the due time', () => {
    const now = new Date(dueAt.getTime() + 26.5 * 60 * 60 * 1000);
    expect(hoursLate(dueAt, now)).toBe(26);
  });

  it('is never negative', () => {
    expect(hoursLate(dueAt, new Date(dueAt.getTime() - 1000))).toBe(0);
  });
});
