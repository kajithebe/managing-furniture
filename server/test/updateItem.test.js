// PATCH /api/items/:code (MF-28, M6 Edit item, 02 › Edit item): details and both rooms.
// A changed home room writes HOME_CHANGED, a changed current room LOCATION_CORRECTED; the
// current room cannot change while the item is on loan. The database is mocked, so these
// tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const item = { findUnique: vi.fn(), updateMany: vi.fn() };
  const itemEvent = { createMany: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      item,
      itemEvent,
      room: { findUnique: vi.fn(), findMany: vi.fn() },
      category: { findUnique: vi.fn() },
      brand: { findUnique: vi.fn() },
      colour: { findUnique: vi.fn() },
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
const D569 = 1; // home room and current room of the chair
const D751 = 2;
const D575 = 3;

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
    homeRoomId: D569,
    currentRoomId: D569,
    condition: 'GOOD',
    onLoan: false,
    createdById: null,
    category: { id: 1, name: 'Chair', code: 'CHR', autoApprove: true },
    ...overrides,
  };
}

function patchChair(body, role = 'MODERATOR') {
  return request(createApp())
    .patch('/api/items/MP-00123')
    .set('Origin', ORIGIN)
    .set('Cookie', loginAs(role))
    .send(body);
}

// The events written in the one transaction, without the fields every event has.
function writtenEvents() {
  return prisma.itemEvent.createMany.mock.calls[0][0].data.map(({ itemId, userId, ...event }) => {
    expect(itemId).toBe(11);
    expect(userId).toBe(MODERATOR_ID);
    return event;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.item.findUnique.mockResolvedValue(chair());
  prisma.item.updateMany.mockResolvedValue({ count: 1 });
  prisma.itemEvent.createMany.mockResolvedValue({ count: 1 });
  prisma.room.findUnique.mockResolvedValue({ archived: false });
});

describe('PATCH /api/items/:code – rooms', () => {
  it('a changed home room is saved with a HOME_CHANGED event', async () => {
    const res = await patchChair({ homeRoomId: D575 });

    expect(res.status).toBe(200);
    expect(prisma.room.findUnique).toHaveBeenCalledWith({
      where: { id: D575 },
      select: { archived: true },
    });
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { homeRoomId: D575 },
    });
    expect(writtenEvents()).toEqual([
      { type: 'HOME_CHANGED', fromRoomId: D569, toRoomId: D575, note: 'Edited' },
    ]);
  });

  it('a changed current room is saved with a LOCATION_CORRECTED event, note "Edited"', async () => {
    const res = await patchChair({ currentRoomId: D751 });

    expect(res.status).toBe(200);
    // Only matches while the item is still not on loan.
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 11, onLoan: false },
      data: { currentRoomId: D751 },
    });
    expect(writtenEvents()).toEqual([
      { type: 'LOCATION_CORRECTED', fromRoomId: D569, toRoomId: D751, note: 'Edited' },
    ]);
  });

  it('details and both rooms in one save: one event per kind of change', async () => {
    const res = await patchChair({
      notes: 'Group work seating',
      homeRoomId: D575,
      currentRoomId: D751,
    });

    expect(res.status).toBe(200);
    expect(prisma.item.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.item.updateMany.mock.calls[0][0].data).toEqual({
      notes: 'Group work seating',
      homeRoomId: D575,
      currentRoomId: D751,
    });
    expect(writtenEvents()).toEqual([
      { type: 'EDITED', note: 'Changed: notes' },
      { type: 'HOME_CHANGED', fromRoomId: D569, toRoomId: D575, note: 'Edited' },
      { type: 'LOCATION_CORRECTED', fromRoomId: D569, toRoomId: D751, note: 'Edited' },
    ]);
  });

  it('unchanged rooms write nothing and are not checked again', async () => {
    // The Edit form always sends both rooms, even when only other fields changed.
    const res = await patchChair({ homeRoomId: D569, currentRoomId: D569 });

    expect(res.status).toBe(200);
    expect(prisma.room.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.itemEvent.createMany).not.toHaveBeenCalled();
  });

  it('an unchanged current room is fine while the item is on loan', async () => {
    prisma.item.findUnique.mockResolvedValue(chair({ onLoan: true, currentRoomId: D751 }));
    prisma.loanItem.findFirst.mockResolvedValue(null);

    const res = await patchChair({ notes: 'Wobbly leg', currentRoomId: D751 });

    expect(res.status).toBe(200);
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { notes: 'Wobbly leg' },
    });
  });
});

describe('PATCH /api/items/:code – room errors', () => {
  it('on loan: a current room change gives 409 ITEM_ON_LOAN and changes nothing', async () => {
    prisma.item.findUnique.mockResolvedValue(chair({ onLoan: true, currentRoomId: D751 }));

    const res = await patchChair({ currentRoomId: D569 });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      itemCode: 'MP-00123',
      code: 'ITEM_ON_LOAN',
      message: 'Mark this item returned first',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.itemEvent.createMany).not.toHaveBeenCalled();
  });

  it('on loan: the home room can still change', async () => {
    prisma.item.findUnique.mockResolvedValue(chair({ onLoan: true, currentRoomId: D751 }));
    prisma.loanItem.findFirst.mockResolvedValue(null);

    const res = await patchChair({ homeRoomId: D575 });

    expect(res.status).toBe(200);
    expect(writtenEvents()).toEqual([
      { type: 'HOME_CHANGED', fromRoomId: D569, toRoomId: D575, note: 'Edited' },
    ]);
  });

  it('borrowed meanwhile: the guarded update matches nothing → 409 ITEM_ON_LOAN, no events', async () => {
    prisma.item.updateMany.mockResolvedValue({ count: 0 });

    const res = await patchChair({ currentRoomId: D751 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_ON_LOAN');
    expect(prisma.itemEvent.createMany).not.toHaveBeenCalled();
  });

  it('unknown room → 404 ROOM_NOT_FOUND', async () => {
    prisma.room.findUnique.mockResolvedValue(null);

    const res = await patchChair({ homeRoomId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: 'Choose a room from the list.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('archived room → 404 ROOM_NOT_FOUND', async () => {
    prisma.room.findUnique.mockResolvedValue({ archived: true });

    const res = await patchChair({ currentRoomId: D751 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a room id that is not a positive whole number → 400', async () => {
    const res = await patchChair({ homeRoomId: 'D569' });

    expect(res.status).toBe(400);
    expect(prisma.item.findUnique).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/items/:code – access', () => {
  it('no session → 401', async () => {
    const res = await request(createApp())
      .patch('/api/items/MP-00123')
      .set('Origin', ORIGIN)
      .send({ homeRoomId: D575 });

    expect(res.status).toBe(401);
  });

  it('a student → 403', async () => {
    const res = await patchChair({ homeRoomId: D575 }, 'USER');

    expect(res.status).toBe(403);
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });
});
