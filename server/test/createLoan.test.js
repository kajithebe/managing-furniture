// POST /api/loans (MF-10): borrow request with auto-approval by category and the S4 errors.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    setting: { findUniqueOrThrow: vi.fn() },
    room: { findFirst: vi.fn(), findMany: vi.fn() },
    item: { findMany: vi.fn(), updateMany: vi.fn() },
    loan: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    itemEvent: { createMany: vi.fn() },
  };
  // The transaction callback gets the same mocked client.
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  return { prisma };
});

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
const HOUR = 60 * 60 * 1000;
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

const chair = {
  id: 11,
  code: 'MP-00123',
  onLoan: false,
  condition: 'GOOD',
  currentRoomId: D569.id,
  category: { autoApprove: true },
};
const table = {
  id: 12,
  code: 'MP-02210',
  onLoan: false,
  condition: 'GOOD',
  currentRoomId: D569.id,
  category: { autoApprove: false },
};

function body(overrides = {}) {
  return {
    itemCodes: ['MP-00123', 'MP-02210'],
    toRoomId: D751.id,
    dueAt: new Date(Date.now() + 2 * HOUR).toISOString(),
    reason: 'Group work',
    ...overrides,
  };
}

function post(data) {
  return request(createApp())
    .post('/api/loans')
    .set('Origin', ORIGIN)
    .set('Cookie', sessionCookie(7))
    .send(data);
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
  prisma.setting.findUniqueOrThrow.mockResolvedValue({ maxLoanHours: 4 });
  prisma.room.findFirst.mockResolvedValue({ id: D751.id });
  prisma.room.findMany.mockResolvedValue([D569, D751]);
  prisma.item.findMany.mockResolvedValue([chair, table]);
  prisma.item.updateMany.mockResolvedValue({ count: 1 });
  prisma.loan.create.mockResolvedValue({ id: 5 });
  prisma.itemEvent.createMany.mockResolvedValue({ count: 1 });
  prisma.loan.findUniqueOrThrow.mockResolvedValue({
    id: 5,
    status: 'OPEN',
    reason: 'Group work',
    dueAt: new Date('2026-11-09T12:00:00Z'),
    createdAt: new Date('2026-11-09T07:58:00Z'),
    closedAt: null,
    toRoomId: D751.id,
    items: [
      {
        id: 21,
        status: 'APPROVED',
        fromRoomId: D569.id,
        item: {
          code: 'MP-00123',
          name: 'Chair',
          condition: 'GOOD',
          category: { name: 'Chair' },
          homeRoom: D569,
        },
      },
      {
        id: 22,
        status: 'PENDING',
        fromRoomId: D569.id,
        item: {
          code: 'MP-02210',
          name: 'Table',
          condition: 'GOOD',
          category: { name: 'Table' },
          homeRoom: D569,
        },
      },
    ],
  });
});

describe('POST /api/loans', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).post('/api/loans').set('Origin', ORIGIN).send(body());
    expect(res.status).toBe(401);
  });

  it('approves chairs at once and leaves the table waiting (S6)', async () => {
    const res = await post(body());

    expect(res.status).toBe(201);
    expect(res.body.toRoom).toEqual(D751);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        code: 'MP-00123',
        status: 'APPROVED',
        homeRoom: D569,
        fromRoom: D569,
      }),
      expect.objectContaining({
        code: 'MP-02210',
        status: 'PENDING',
        homeRoom: D569,
        fromRoom: D569,
      }),
    ]);

    // The borrower comes from the session; every item remembers where it came from.
    expect(prisma.loan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 7,
          toRoomId: D751.id,
          reason: 'Group work',
          items: {
            create: [
              { itemId: chair.id, fromRoomId: D569.id, status: 'APPROVED' },
              { itemId: table.id, fromRoomId: D569.id, status: 'PENDING' },
            ],
          },
        }),
      }),
    );

    // Only the chair is on loan and moves to D751, and only it gets a history event.
    expect(prisma.item.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: chair.id, onLoan: false },
      data: { onLoan: true, currentRoomId: D751.id },
    });
    expect(prisma.itemEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          itemId: chair.id,
          type: 'BORROWED',
          userId: 7,
          loanId: 5,
          fromRoomId: D569.id,
          toRoomId: D751.id,
          note: 'Group work',
        },
      ],
    });
  });

  it('writes no history when every item waits for a moderator', async () => {
    prisma.item.findMany.mockResolvedValue([table]);
    const res = await post(body({ itemCodes: ['MP-02210'] }));
    expect(res.status).toBe(201);
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
    expect(prisma.itemEvent.createMany).not.toHaveBeenCalled();
  });

  it('accepts lower-case codes from typing', async () => {
    const res = await post(body({ itemCodes: ['mp-00123', ' MP-02210 '] }));
    expect(res.status).toBe(201);
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: { in: ['MP-00123', 'MP-02210'] } } }),
    );
  });

  it('refuses an until time longer than the setting', async () => {
    const res = await post(body({ dueAt: new Date(Date.now() + 5 * HOUR).toISOString() }));
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'LOAN_TOO_LONG',
      message: 'Until time is longer than 4 hours.',
      maxLoanHours: 4,
    });
    expect(prisma.loan.create).not.toHaveBeenCalled();
  });

  it('S4: refuses the whole request when an item was borrowed meanwhile', async () => {
    prisma.item.findMany.mockResolvedValue([chair, { ...table, code: 'MP-00125', onLoan: true }]);
    const res = await post(body({ itemCodes: ['MP-00123', 'MP-00125'] }));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'ITEM_NOT_AVAILABLE',
      message: 'One item was borrowed by someone else meanwhile: MP-00125',
      items: [{ code: 'MP-00125', status: 'ON_LOAN' }],
    });
    expect(prisma.loan.create).not.toHaveBeenCalled();
  });

  it('refuses when another request took the chair at the same moment', async () => {
    prisma.item.updateMany.mockResolvedValue({ count: 0 });
    const res = await post(body());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_NOT_AVAILABLE');
    expect(res.body.error.message).toBe(
      'One item was borrowed by someone else meanwhile: MP-00123',
    );
  });

  it('S3 wording for an unknown code', async () => {
    prisma.item.findMany.mockResolvedValue([chair]);
    const res = await post(body({ itemCodes: ['MP-00123', 'MP-99999'] }));
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ITEM_NOT_FOUND',
      message: "We couldn't find item MP-99999. Check the code on the sticker.",
      itemCode: 'MP-99999',
    });
  });

  it('refuses an unknown or archived room', async () => {
    prisma.room.findFirst.mockResolvedValue(null);
    const res = await post(body());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it.each([
    ['no items', { itemCodes: [] }],
    ['the same item twice', { itemCodes: ['MP-00123', 'mp-00123'] }],
    ['an empty reason', { reason: '   ' }],
    ['a reason over 120 characters', { reason: 'x'.repeat(121) }],
    ['an until time without a time zone', { dueAt: '2026-11-09T14:00:00' }],
    ['a room id as text', { toRoomId: 'D751' }],
  ])('400 for %s', async (label, overrides) => {
    const res = await post(body(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.loan.create).not.toHaveBeenCalled();
  });
});
