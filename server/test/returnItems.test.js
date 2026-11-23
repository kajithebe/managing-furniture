// POST /api/loans/:id/return (MF-19): S9 item scans, partial return, loan closed (S10).
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    loan: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    loanItem: { updateMany: vi.fn(), findMany: vi.fn() },
    item: { update: vi.fn() },
    itemEvent: { createMany: vi.fn() },
    room: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  // The transaction callback gets the same mocked client.
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  return { prisma };
});

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
const D569 = { id: 1, name: 'D569' };
const D751 = { id: 2, name: 'D751' };
const TOKEN = 'k3J9xQ2mP7vL1aZ8';

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

// Loan 5 of user 7: three chairs from D569, on loan in D751.
function loanItem(id, code, status = 'APPROVED') {
  return { id, status, item: { id: id + 100, code, currentRoomId: D751.id, homeRoom: D569 } };
}

const openLoan = {
  id: 5,
  status: 'OPEN',
  items: [loanItem(21, 'MP-00123'), loanItem(22, 'MP-00124', 'OVERDUE'), loanItem(23, 'MP-00125')],
};

// The reply (Loan shape) after the return; its content comes from the mock.
const loanAfter = {
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
      status: 'RETURNED',
      fromRoomId: D569.id,
      item: {
        code: 'MP-00123',
        name: 'Chair',
        condition: 'NEEDS_REPAIR',
        category: { name: 'Chair' },
        homeRoom: D569,
      },
    },
  ],
};

function post(data, loanId = 5, cookie = sessionCookie(7)) {
  return request(createApp())
    .post(`/api/loans/${loanId}/return`)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
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
  prisma.loan.findFirst.mockResolvedValue(openLoan);
  prisma.room.findUnique.mockResolvedValue(D569);
  prisma.room.findMany.mockResolvedValue([D569, D751]);
  prisma.loanItem.updateMany.mockResolvedValue({ count: 1 });
  prisma.item.update.mockResolvedValue({});
  prisma.itemEvent.createMany.mockResolvedValue({ count: 1 });
  prisma.loanItem.findMany.mockResolvedValue([
    { status: 'RETURNED' },
    { status: 'OVERDUE' },
    { status: 'APPROVED' },
  ]);
  prisma.loan.update.mockResolvedValue({});
  prisma.loan.findUniqueOrThrow.mockResolvedValue(loanAfter);
});

describe('POST /api/loans/:id/return', () => {
  it('needs a session', async () => {
    const res = await request(createApp())
      .post('/api/loans/5/return')
      .set('Origin', ORIGIN)
      .send({ roomQrToken: TOKEN, itemCodes: ['MP-00123'] });
    expect(res.status).toBe(401);
  });

  it('validates the body', async () => {
    const res = await post({ roomQrToken: TOKEN, itemCodes: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("finds only the user's own loan: another user's loan is not found", async () => {
    prisma.loan.findFirst.mockResolvedValue(null);
    const res = await post({ roomQrToken: TOKEN, itemCodes: ['MP-00123'] }, 9);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Not found.' });
    expect(prisma.loan.findFirst.mock.calls[0][0].where).toEqual({ id: 9, userId: 7 });
  });

  it('refuses an unknown door QR', async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    const res = await post({ roomQrToken: 'unknown-token', itemCodes: ['MP-00123'] });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
  });

  it('returns one scanned item: back home, free, condition kept, loan stays open (S9)', async () => {
    const res = await post({ roomQrToken: TOKEN, itemCodes: ['mp-00123'] });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ code: 'MP-00123', status: 'RETURNED' });

    expect(prisma.loanItem.updateMany).toHaveBeenCalledTimes(1);
    const update = prisma.loanItem.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: 21, status: { in: ['APPROVED', 'OVERDUE'] } });
    expect(update.data).toMatchObject({
      status: 'RETURNED',
      returnMethod: 'SCAN',
      returnedById: 7,
    });

    // Only onLoan and the room change; the condition is never part of the update.
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: 121 },
      data: { onLoan: false, currentRoomId: D569.id },
    });
    expect(prisma.itemEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          itemId: 121,
          type: 'RETURNED',
          userId: 7,
          loanId: 5,
          fromRoomId: D751.id,
          toRoomId: D569.id,
        },
      ],
    });
    expect(prisma.loan.update).not.toHaveBeenCalled();
  });

  it('closes the loan when the last items come back (S10 loan closed)', async () => {
    prisma.loanItem.findMany.mockResolvedValue([
      { status: 'RETURNED' },
      { status: 'RETURNED' },
      { status: 'RETURNED' },
    ]);
    const res = await post({
      roomQrToken: TOKEN,
      itemCodes: ['MP-00123', 'MP-00124', 'MP-00125'],
    });

    expect(res.status).toBe(200);
    expect(prisma.itemEvent.createMany.mock.calls[0][0].data).toHaveLength(3);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'CLOSED', closedAt: expect.any(Date) },
    });
  });

  it('skips an item a moderator returned at the same moment', async () => {
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });
    const res = await post({ roomQrToken: TOKEN, itemCodes: ['MP-00123'] });

    expect(res.status).toBe(200);
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(prisma.itemEvent.createMany).not.toHaveBeenCalled();
  });

  it('S8: refuses the wrong room and changes nothing', async () => {
    prisma.room.findUnique.mockResolvedValue(D751);
    const res = await post({ roomQrToken: TOKEN, itemCodes: ['MP-00123'] });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'WRONG_ROOM',
      message: 'This is D751. These items belong in D569.',
      room: D751,
      homeRoom: D569,
    });
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });

  it('S9: refuses an item that is not part of the loan', async () => {
    const res = await post({ roomQrToken: TOKEN, itemCodes: ['MP-00456'] });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'ITEM_NOT_IN_LOAN',
      message: 'MP-00456 is not part of this loan',
      itemCode: 'MP-00456',
    });
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });
});
