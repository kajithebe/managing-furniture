// POST /api/moderator/loan-items/:id/mark-returned (MF-23, P12): a moderator confirms a return.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    loan: { findUnique: vi.fn(), update: vi.fn() },
    loanItem: { findUnique: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    item: { update: vi.fn() },
    itemEvent: { create: vi.fn() },
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
const mikko = { id: 9, name: 'Mikko Laine' };

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
    ...mikko,
    email: 'mikko.laine@metropolia.fi',
    role,
    active: true,
  });
  return sessionCookie(mikko.id);
}

// LoanItem 31: Chair MP-00126 of loan 4, not yet returned, still in D751; home room D569.
function loanItemRow(status = 'OVERDUE') {
  return {
    id: 31,
    status,
    loanId: 4,
    item: {
      id: 126,
      code: 'MP-00126',
      name: 'Chair',
      currentRoomId: D751.id,
      category: { name: 'Chair' },
      homeRoom: D569,
    },
  };
}

function post(id, body, role = 'MODERATOR') {
  return request(createApp())
    .post(`/api/moderator/loan-items/${id}/mark-returned`)
    .set('Origin', ORIGIN)
    .set('Cookie', loginAs(role))
    .send(body);
}

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.loanItem.findUnique.mockResolvedValue(loanItemRow());
  prisma.loanItem.updateMany.mockResolvedValue({ count: 1 });
  // The other item of the loan is still out, so the loan stays open.
  prisma.loanItem.findMany.mockResolvedValue([{ status: 'RETURNED' }, { status: 'OVERDUE' }]);
});

describe('POST /api/moderator/loan-items/:id/mark-returned', () => {
  it('needs a session', async () => {
    const res = await request(createApp())
      .post('/api/moderator/loan-items/31/mark-returned')
      .set('Origin', ORIGIN)
      .send({});
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await post(31, {}, 'USER');
    expect(res.status).toBe(403);
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });

  it('returns the item with method MODERATOR, back to its home room, with the note', async () => {
    const res = await post(31, { note: '  Found in D751, moved back by caretaker ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 31,
      status: 'RETURNED',
      code: 'MP-00126',
      name: 'Chair',
      category: 'Chair',
      returnMethod: 'MODERATOR',
      returnedBy: mikko,
      note: 'Found in D751, moved back by caretaker',
      loan: { id: 4, status: 'OPEN' },
    });

    // Only an item that is still out changes.
    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: 31, status: { in: ['APPROVED', 'OVERDUE'] } },
      data: expect.objectContaining({
        status: 'RETURNED',
        returnMethod: 'MODERATOR',
        returnedById: mikko.id,
      }),
    });
    // Free again and back home; the condition is not touched.
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: 126 },
      data: { onLoan: false, currentRoomId: D569.id },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledWith({
      data: {
        itemId: 126,
        type: 'MARKED_RETURNED',
        userId: mikko.id,
        loanId: 4,
        fromRoomId: D751.id,
        toRoomId: D569.id,
        note: 'Found in D751, moved back by caretaker',
      },
    });
    expect(prisma.loan.update).not.toHaveBeenCalled();
  });

  it('works without a note, and for items that are on loan but not late yet (M7)', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(loanItemRow('APPROVED'));

    const res = await post(31, { note: '' });

    expect(res.status).toBe(200);
    expect(res.body.note).toBeNull();
    expect(prisma.itemEvent.create.mock.calls[0][0].data.note).toBeNull();
  });

  it('closes the loan when this was its last open item', async () => {
    prisma.loanItem.findMany.mockResolvedValue([{ status: 'RETURNED' }, { status: 'DECLINED' }]);

    const res = await post(31, {});

    expect(res.body.loan).toEqual({ id: 4, status: 'CLOSED' });
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { status: 'CLOSED', closedAt: expect.any(Date) },
    });
  });

  it('refuses an item that is already returned, without a second event', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(loanItemRow('RETURNED'));

    const res = await post(31, {});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'ALREADY_RETURNED',
      message: 'This item is already returned',
      itemCode: 'MP-00126',
    });
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('refuses the item when a scan was quicker', async () => {
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });

    const res = await post(31, {});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_RETURNED');
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('refuses items that are waiting or declined', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(loanItemRow('PENDING'));
    let res = await post(31, {});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'ITEM_NOT_ON_LOAN',
      message: 'MP-00126 is still waiting for approval',
      itemCode: 'MP-00126',
    });

    prisma.loanItem.findUnique.mockResolvedValue(loanItemRow('DECLINED'));
    res = await post(31, {});
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("MP-00126 was declined, so it isn't on loan");
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });

  it('gives 404 for an unknown loan item', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(null);
    const res = await post(999, {});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a note longer than 500 characters', async () => {
    const res = await post(31, { note: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
