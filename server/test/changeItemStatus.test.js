// PATCH /api/items/:code/status (MF-29, M7 "Change status"): a new condition with a reason.
// Blocked while the item is on loan; writes a STATUS_CHANGED event whose note is the new
// condition, a colon and the reason (agreed 23 Nov 2026). The database is mocked, so these
// tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const item = { findUnique: vi.fn(), updateMany: vi.fn() };
  const itemEvent = { create: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      item,
      itemEvent,
      loanItem: { findFirst: vi.fn() },
      // The service's transaction callback gets the same mocks as tx.
      $transaction: vi.fn((callback) => callback({ item, itemEvent })),
    },
  };
});

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
const MODERATOR_ID = 4;
const REASON = 'Wobbly leg';

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
    id: MODERATOR_ID,
    email: 'mikko.laine@metropolia.fi',
    name: 'Mikko Laine',
    role,
    active: true,
  });
  return sessionCookie(MODERATOR_ID);
}

function chair(overrides = {}) {
  return {
    id: 11,
    code: 'MP-00123',
    name: 'Chair',
    categoryId: 1,
    brandId: null,
    colourId: null,
    hasWheels: false,
    wheelCount: null,
    notes: null,
    homeRoomId: 1,
    currentRoomId: 1,
    condition: 'GOOD',
    onLoan: false,
    createdById: null,
    category: { id: 1, name: 'Chair', code: 'CHR', autoApprove: true },
    ...overrides,
  };
}

function patchStatus(body, { role = 'MODERATOR', code = 'MP-00123' } = {}) {
  return request(createApp())
    .patch(`/api/items/${code}/status`)
    .set('Origin', ORIGIN)
    .set('Cookie', loginAs(role))
    .send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.item.findUnique.mockResolvedValue(chair());
  prisma.item.updateMany.mockResolvedValue({ count: 1 });
  prisma.itemEvent.create.mockResolvedValue({});
});

describe('PATCH /api/items/:code/status', () => {
  it('saves the new condition with a STATUS_CHANGED event "NEEDS_REPAIR: Wobbly leg"', async () => {
    const res = await patchStatus({ condition: 'NEEDS_REPAIR', reason: REASON });

    expect(res.status).toBe(200);
    // Only matches while the item is still not on loan.
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 11, onLoan: false },
      data: { condition: 'NEEDS_REPAIR' },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledWith({
      data: {
        itemId: 11,
        type: 'STATUS_CHANGED',
        userId: MODERATOR_ID,
        note: 'NEEDS_REPAIR: Wobbly leg',
      },
    });
  });

  it('returns the item with its shown status', async () => {
    prisma.item.findUnique
      .mockResolvedValueOnce(chair()) // the check before the change
      .mockResolvedValue(chair({ condition: 'BROKEN' })); // getItem after the change

    const res = await patchStatus({ condition: 'BROKEN', reason: REASON });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: 'MP-00123', status: 'BROKEN', borrowable: false });
  });

  it('every stored condition can be chosen, Disposed included', async () => {
    for (const condition of ['GOOD', 'NEEDS_REPAIR', 'BROKEN', 'IN_REPAIR', 'DISPOSED']) {
      prisma.item.findUnique.mockResolvedValue(chair({ condition: 'IN_REPAIR' }));
      if (condition === 'IN_REPAIR') {
        continue;
      }
      const res = await patchStatus({ condition, reason: REASON });
      expect(res.status).toBe(200);
    }
    expect(prisma.itemEvent.create).toHaveBeenCalledTimes(4);
  });

  it('the reason is trimmed before it goes into the note', async () => {
    await patchStatus({ condition: 'IN_REPAIR', reason: '  Sent to workshop  ' });

    expect(prisma.itemEvent.create.mock.calls[0][0].data.note).toBe('IN_REPAIR: Sent to workshop');
  });

  it('a lower-case code in the address is found', async () => {
    await patchStatus({ condition: 'BROKEN', reason: REASON }, { code: 'mp-00123' });

    expect(prisma.item.findUnique.mock.calls[0][0].where).toEqual({ code: 'MP-00123' });
  });

  it('the same condition again changes nothing and writes no event', async () => {
    const res = await patchStatus({ condition: 'GOOD', reason: REASON });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('a client cannot set onLoan through this route', async () => {
    await patchStatus({ condition: 'BROKEN', reason: REASON, onLoan: true });

    expect(prisma.item.updateMany.mock.calls[0][0].data).toEqual({ condition: 'BROKEN' });
  });
});

describe('PATCH /api/items/:code/status – errors', () => {
  it('on loan → 409 ITEM_ON_LOAN "Mark this item returned first", nothing saved', async () => {
    prisma.item.findUnique.mockResolvedValue(chair({ onLoan: true }));

    const res = await patchStatus({ condition: 'BROKEN', reason: REASON });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      itemCode: 'MP-00123',
      code: 'ITEM_ON_LOAN',
      message: 'Mark this item returned first',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('borrowed meanwhile: the guarded update matches nothing → 409, no event', async () => {
    prisma.item.updateMany.mockResolvedValue({ count: 0 });

    const res = await patchStatus({ condition: 'BROKEN', reason: REASON });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_ON_LOAN');
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('unknown item → 404 ITEM_NOT_FOUND', async () => {
    prisma.item.findUnique.mockResolvedValue(null);

    const res = await patchStatus({ condition: 'BROKEN', reason: REASON }, { code: 'MP-99999' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
  });

  it('no reason → 400 VALIDATION_ERROR', async () => {
    const res = await patchStatus({ condition: 'BROKEN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.item.findUnique).not.toHaveBeenCalled();
  });

  it('only spaces as the reason → 400', async () => {
    const res = await patchStatus({ condition: 'BROKEN', reason: '   ' });

    expect(res.status).toBe(400);
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });

  it('a reason longer than 500 characters → 400', async () => {
    const res = await patchStatus({ condition: 'BROKEN', reason: 'x'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('a shown status that is not stored (ON_LOAN, AVAILABLE) → 400', async () => {
    for (const condition of ['ON_LOAN', 'AVAILABLE']) {
      const res = await patchStatus({ condition, reason: REASON });
      expect(res.status).toBe(400);
    }
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });

  it('no session → 401', async () => {
    const res = await request(createApp())
      .patch('/api/items/MP-00123/status')
      .set('Origin', ORIGIN)
      .send({ condition: 'BROKEN', reason: REASON });

    expect(res.status).toBe(401);
  });

  it('a student → 403', async () => {
    const res = await patchStatus({ condition: 'BROKEN', reason: REASON }, { role: 'USER' });

    expect(res.status).toBe(403);
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });
});
