// PATCH /api/items/:code/location and /home (MF-29, M7 "Correct location" and "Change home
// room"): one room with a reason. They use the Edit form's rules (updateItem), so these tests
// cover what is new: the request shape, the events and the on-loan rules. The database is
// mocked, so these tests run anywhere, including CI.
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
const D740 = 3;
const REASON = 'Found in corridor';

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

// The chair is on loan to Aino Virtanen in D751.
function onLoan() {
  prisma.item.findUnique.mockResolvedValue(chair({ onLoan: true, currentRoomId: D751 }));
  prisma.loanItem.findFirst.mockResolvedValue({
    id: 31,
    status: 'APPROVED',
    loan: {
      id: 7,
      dueAt: new Date('2026-11-09T12:00:00Z'),
      toRoomId: D751,
      user: { id: 9, name: 'Aino Virtanen' },
    },
  });
  prisma.room.findMany.mockResolvedValue([{ id: D751, name: 'D751' }]);
}

function patch(action, body, role = 'MODERATOR') {
  return request(createApp())
    .patch(`/api/items/MP-00123/${action}`)
    .set('Origin', ORIGIN)
    .set('Cookie', loginAs(role))
    .send(body);
}

function writtenEvents() {
  return prisma.itemEvent.createMany.mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.item.findUnique.mockResolvedValue(chair());
  prisma.item.updateMany.mockResolvedValue({ count: 1 });
  prisma.itemEvent.createMany.mockResolvedValue({ count: 1 });
  prisma.room.findUnique.mockResolvedValue({ archived: false });
});

describe('PATCH /api/items/:code/location', () => {
  it('saves the current room with a LOCATION_CORRECTED event, note = reason', async () => {
    const res = await patch('location', { currentRoomId: D740, reason: REASON });

    expect(res.status).toBe(200);
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 11, onLoan: false },
      data: { currentRoomId: D740 },
    });
    expect(writtenEvents()).toEqual([
      {
        itemId: 11,
        userId: MODERATOR_ID,
        type: 'LOCATION_CORRECTED',
        fromRoomId: D569,
        toRoomId: D740,
        note: REASON,
      },
    ]);
  });

  it('only the current room can change here: a sent home room is ignored', async () => {
    await patch('location', { currentRoomId: D740, homeRoomId: D751, reason: REASON });

    expect(prisma.item.updateMany.mock.calls[0][0].data).toEqual({ currentRoomId: D740 });
  });

  it('on loan → 409 ITEM_ON_LOAN "Mark this item returned first"', async () => {
    onLoan();

    const res = await patch('location', { currentRoomId: D569, reason: REASON });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Mark this item returned first');
    expect(prisma.itemEvent.createMany).not.toHaveBeenCalled();
  });

  it('archived room → 404 ROOM_NOT_FOUND', async () => {
    prisma.room.findUnique.mockResolvedValue({ archived: true });

    const res = await patch('location', { currentRoomId: D740, reason: REASON });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('no room or no reason → 400 VALIDATION_ERROR', async () => {
    expect((await patch('location', { reason: REASON })).status).toBe(400);
    expect((await patch('location', { currentRoomId: D740 })).status).toBe(400);
    expect((await patch('location', { currentRoomId: D740, reason: '  ' })).status).toBe(400);
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/items/:code/home', () => {
  it('saves the home room with a HOME_CHANGED event, note = reason', async () => {
    const res = await patch('home', { homeRoomId: D740, reason: 'New project room' });

    expect(res.status).toBe(200);
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { homeRoomId: D740 },
    });
    expect(writtenEvents()).toEqual([
      {
        itemId: 11,
        userId: MODERATOR_ID,
        type: 'HOME_CHANGED',
        fromRoomId: D569,
        toRoomId: D740,
        note: 'New project room',
      },
    ]);
  });

  it('on loan: the home room can still change, and the item comes back with its loan', async () => {
    onLoan();

    const res = await patch('home', { homeRoomId: D740, reason: REASON });

    expect(res.status).toBe(200);
    // The returned item shows the borrower to the moderator, like GET /items/:code.
    expect(res.body.currentLoan).toMatchObject({
      loanId: 7,
      borrower: { id: 9, name: 'Aino Virtanen' },
    });
  });

  it('the same home room again writes nothing', async () => {
    const res = await patch('home', { homeRoomId: D569, reason: REASON });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a student → 403, no session → 401', async () => {
    expect((await patch('home', { homeRoomId: D740, reason: REASON }, 'USER')).status).toBe(403);
    const res = await request(createApp())
      .patch('/api/items/MP-00123/home')
      .set('Origin', ORIGIN)
      .send({ homeRoomId: D740, reason: REASON });
    expect(res.status).toBe(401);
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/items/:code on an item on loan (fix: the item is returned with the viewer)', () => {
  it('editing the notes of an item on loan returns 200 with the borrower', async () => {
    onLoan();

    const edit = await request(createApp())
      .patch('/api/items/MP-00123')
      .set('Origin', ORIGIN)
      .set('Cookie', loginAs('MODERATOR'))
      .send({ notes: 'Wobbly leg' });
    expect(edit.status).toBe(200);
    expect(edit.body.currentLoan.borrower).toEqual({ id: 9, name: 'Aino Virtanen' });
  });
});
