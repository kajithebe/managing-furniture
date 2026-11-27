// GET /api/items/:code/history (MF-32, M7 History card): who may open it, the unknown-item
// error, and the events of one item. The database is mocked, so this runs anywhere.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    item: { findUnique: vi.fn() },
    itemEvent: { count: vi.fn(), findMany: vi.fn() },
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

function getHistory(code, query, cookie) {
  const req = request(createApp()).get(`/api/items/${code}/history`).query(query);
  return cookie ? req.set('Cookie', cookie) : req;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.item.findUnique.mockResolvedValue({ id: 123 });
  prisma.itemEvent.count.mockResolvedValue(0);
  prisma.itemEvent.findMany.mockResolvedValue([]);
  prisma.user.findMany.mockResolvedValue([{ id: 4, name: 'Mikko Laine' }]);
  prisma.room.findMany.mockResolvedValue([
    { id: 1, name: 'D569' },
    { id: 6, name: 'D751' },
  ]);
});

describe('GET /api/items/:code/history – access', () => {
  it('refuses a request without a session (401)', async () => {
    const res = await getHistory('MP-00123', {});
    expect(res.status).toBe(401);
    expect(prisma.itemEvent.findMany).not.toHaveBeenCalled();
  });

  it('refuses a student (403)', async () => {
    const res = await getHistory('MP-00123', {}, loginAs('USER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(prisma.itemEvent.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/items/:code/history', () => {
  it("returns one page of the item's events, newest first", async () => {
    prisma.itemEvent.count.mockResolvedValue(30);
    prisma.itemEvent.findMany.mockResolvedValue([
      {
        id: 31,
        type: 'LOCATION_CORRECTED',
        createdAt: new Date('2026-11-05T12:00:00Z'),
        userId: 4,
        loanId: null,
        fromRoomId: 6,
        toRoomId: 1,
        note: 'found in corridor',
        item: { code: 'MP-00123', name: 'Chair' },
      },
    ]);

    // A typed code may be lower case: it is upper-cased like everywhere else.
    const res = await getHistory('mp-00123', { page: '2' }, loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(prisma.item.findUnique).toHaveBeenCalledWith({
      where: { code: 'MP-00123' },
      select: { id: true },
    });
    expect(prisma.itemEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId: 123 },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 25,
        take: 25,
      }),
    );
    expect(res.body).toEqual({
      total: 30,
      data: [
        {
          id: 31,
          type: 'LOCATION_CORRECTED',
          createdAt: '2026-11-05T12:00:00.000Z',
          user: { id: 4, name: 'Mikko Laine' },
          item: { code: 'MP-00123', name: 'Chair' },
          loanId: null,
          fromRoom: { id: 6, name: 'D751' },
          toRoom: { id: 1, name: 'D569' },
          condition: null,
          note: 'found in corridor',
        },
      ],
    });
  });

  it('gives 404 ITEM_NOT_FOUND for an unknown code', async () => {
    prisma.item.findUnique.mockResolvedValue(null);
    const res = await getHistory('MP-99999', {}, loginAs('ADMIN'));
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ITEM_NOT_FOUND',
      message: 'No item with code MP-99999',
      itemCode: 'MP-99999',
    });
    expect(prisma.itemEvent.findMany).not.toHaveBeenCalled();
  });

  it('refuses more than 100 events per page (400)', async () => {
    const res = await getHistory('MP-00123', { pageSize: '500' }, loginAs('MODERATOR'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
