// GET /api/loans/mine (MF-10): S7 My loans – open loans first, then the last 5 closed.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    loan: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const D569 = { id: 1, name: 'D569' };
const D751 = { id: 2, name: 'D751' };

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function loan(id, status, itemStatuses) {
  return {
    id,
    status,
    reason: 'Group work',
    dueAt: new Date('2026-11-09T12:00:00Z'),
    createdAt: new Date('2026-11-09T07:58:00Z'),
    closedAt: status === 'CLOSED' ? new Date('2026-11-09T11:50:00Z') : null,
    toRoomId: D751.id,
    items: itemStatuses.map((itemStatus, index) => ({
      id: id * 10 + index,
      status: itemStatus,
      fromRoomId: D569.id,
      item: {
        code: `MP-0012${index}`,
        name: 'Chair',
        condition: 'GOOD',
        category: { name: 'Chair' },
        homeRoom: D569,
      },
    })),
  };
}

function getMine() {
  return request(createApp()).get('/api/loans/mine').set('Cookie', sessionCookie(7));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({
    id: 7,
    email: 'aino.virtanen@metropolia.fi',
    name: 'Aino Virtanen',
    role: 'USER',
    active: true,
  });
  prisma.room.findMany.mockResolvedValue([D569, D751]);
});

describe('GET /api/loans/mine', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/loans/mine');
    expect(res.status).toBe(401);
    expect(prisma.loan.findMany).not.toHaveBeenCalled();
  });

  it('returns open loans and recent closed loans in the S7 shape', async () => {
    prisma.loan.findMany
      .mockResolvedValueOnce([loan(3, 'OPEN', ['APPROVED', 'OVERDUE', 'PENDING'])])
      .mockResolvedValueOnce([loan(2, 'CLOSED', ['RETURNED', 'RETURNED'])]);

    const res = await getMine();

    expect(res.status).toBe(200);
    expect(res.body.open).toHaveLength(1);
    expect(res.body.open[0]).toEqual({
      id: 3,
      status: 'OPEN',
      reason: 'Group work',
      dueAt: '2026-11-09T12:00:00.000Z',
      createdAt: '2026-11-09T07:58:00.000Z',
      closedAt: null,
      toRoom: D751,
      items: [
        expect.objectContaining({ code: 'MP-00120', status: 'APPROVED', homeRoom: D569 }),
        expect.objectContaining({ code: 'MP-00121', status: 'OVERDUE', homeRoom: D569 }),
        expect.objectContaining({ code: 'MP-00122', status: 'PENDING', homeRoom: D569 }),
      ],
    });
    expect(res.body.recent).toEqual([
      expect.objectContaining({ id: 2, status: 'CLOSED', closedAt: '2026-11-09T11:50:00.000Z' }),
    ]);
    expect(res.body.recent[0].items).toHaveLength(2);
  });

  it('only reads the logged-in user’s loans: due first, then the last 5 closed', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    await getMine();

    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, status: 'OPEN' },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, status: 'CLOSED' },
        orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    );
  });

  it('ignores a user id in the query string', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    await request(createApp()).get('/api/loans/mine?userId=1').set('Cookie', sessionCookie(7));
    for (const [args] of prisma.loan.findMany.mock.calls) {
      expect(args.where.userId).toBe(7);
    }
  });

  it('S7 empty state: no loans gives two empty lists', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    const res = await getMine();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ open: [], recent: [] });
  });
});
