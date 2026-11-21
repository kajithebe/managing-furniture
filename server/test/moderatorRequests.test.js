// GET /api/moderator/requests (MF-10): M2 Waiting tab – requests with waiting items, oldest first.
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
const D512 = { id: 3, name: 'D512' };
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

function loanItem(id, status, code, category, fromRoomId, decidedById = null) {
  return {
    id,
    status,
    fromRoomId,
    decidedById,
    item: { code, name: category, category: { name: category } },
  };
}

// The first request on M2: a table and a sofa waiting, four chairs auto-approved.
const ainoRequest = {
  id: 5,
  reason: 'Group work',
  dueAt: new Date('2026-11-09T12:00:00Z'),
  createdAt: new Date('2026-11-09T07:58:00Z'),
  toRoomId: D751.id,
  user: { id: 7, name: 'Aino Virtanen' },
  items: [
    loanItem(21, 'APPROVED', 'MP-00123', 'Chair', D569.id),
    loanItem(22, 'APPROVED', 'MP-00124', 'Chair', D569.id, 9),
    loanItem(23, 'PENDING', 'MP-02210', 'Table', D569.id),
    loanItem(24, 'PENDING', 'MP-03015', 'Sofa', D512.id),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.room.findMany.mockResolvedValue([D569, D512, D751]);
  prisma.loan.findMany.mockResolvedValue([ainoRequest]);
});

describe('GET /api/moderator/requests', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/moderator/requests');
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await request(createApp())
      .get('/api/moderator/requests')
      .set('Cookie', loginAs('USER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(prisma.loan.findMany).not.toHaveBeenCalled();
  });

  it('is for admins too', async () => {
    const res = await request(createApp())
      .get('/api/moderator/requests')
      .set('Cookie', loginAs('ADMIN'));
    expect(res.status).toBe(200);
  });

  it('returns each request with its waiting and approved items (M2)', async () => {
    const res = await request(createApp())
      .get('/api/moderator/requests')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.waitingItems).toBe(2);

    const [first] = res.body.data;
    // "Aino Virtanen · to D751 · until 14:00 · Group work · sent 9:58"
    expect(first).toMatchObject({
      id: 5,
      borrower: { id: 7, name: 'Aino Virtanen' },
      toRoom: D751,
      dueAt: '2026-11-09T12:00:00.000Z',
      reason: 'Group work',
      createdAt: '2026-11-09T07:58:00.000Z',
    });
    // Waiting table: Item, Category, From → To.
    expect(first.waiting).toEqual([
      expect.objectContaining({ id: 23, code: 'MP-02210', category: 'Table', fromRoom: D569 }),
      expect.objectContaining({ id: 24, code: 'MP-03015', category: 'Sofa', fromRoom: D512 }),
    ]);
    // "Already approved in this request": auto-approved only when no moderator decided.
    expect(first.approved).toEqual([
      expect.objectContaining({ id: 21, code: 'MP-00123', autoApproved: true }),
      expect.objectContaining({ id: 22, code: 'MP-00124', autoApproved: false }),
    ]);
    // M2 shows no email.
    expect(first.borrower).not.toHaveProperty('email');
  });

  it('asks only for open requests with a waiting item, oldest first', async () => {
    await request(createApp()).get('/api/moderator/requests').set('Cookie', loginAs('MODERATOR'));
    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OPEN', items: { some: { status: 'PENDING' } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('nothing waiting gives an empty list and a zero count', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    const res = await request(createApp())
      .get('/api/moderator/requests')
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.body).toEqual({ data: [], total: 0, waitingItems: 0 });
  });
});
