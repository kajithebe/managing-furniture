// GET /api/items/:code (MF-10 part): the current loan of an item for S3 / S5 and the M7
// "Current loan" card. Students see until when and where, but not who borrowed it.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    item: { findUnique: vi.fn() },
    loanItem: { findFirst: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const D569 = { id: 1, name: 'D569' };
const D751 = { id: 2, name: 'D751' };
const VIEWER_ID = 9;

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

// requireAuth and the M7 "Created by" both read users; answer by id.
function loginAs(role) {
  prisma.user.findUnique.mockImplementation(({ where }) =>
    Promise.resolve(
      where.id === VIEWER_ID
        ? { id: VIEWER_ID, email: 'viewer@metropolia.fi', name: 'Viewer', role, active: true }
        : { id: where.id, name: 'Mikko Laine' },
    ),
  );
  return sessionCookie(VIEWER_ID);
}

function chair(overrides = {}) {
  return {
    id: 11,
    code: 'MP-00123',
    name: 'Chair',
    condition: 'GOOD',
    onLoan: true,
    createdById: 3,
    category: { id: 1, name: 'Chair', code: 'CHR', autoApprove: true },
    ...overrides,
  };
}

function getChair(role) {
  return request(createApp()).get('/api/items/MP-00123').set('Cookie', loginAs(role));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.item.findUnique.mockResolvedValue(chair());
  prisma.room.findMany.mockResolvedValue([D569, D751]);
  prisma.loanItem.findFirst.mockResolvedValue({
    id: 21,
    status: 'APPROVED',
    loan: {
      id: 5,
      dueAt: new Date('2026-11-09T12:00:00Z'),
      toRoomId: D751.id,
      user: { id: 7, name: 'Aino Virtanen' },
    },
  });
});

describe('GET /api/items/:code – current loan', () => {
  it('S3: a student sees until when and where, but not who borrowed it', async () => {
    const res = await getChair('USER');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ON_LOAN');
    expect(res.body.currentLoan).toEqual({
      loanId: 5,
      loanItemId: 21,
      status: 'APPROVED',
      dueAt: '2026-11-09T12:00:00.000Z',
      toRoom: D751,
    });
    expect(res.body.currentLoan).not.toHaveProperty('borrower');
  });

  it('M7: a moderator also sees the borrower, for "Aino Virtanen" on the card', async () => {
    const res = await getChair('MODERATOR');
    expect(res.body.currentLoan).toMatchObject({
      loanId: 5,
      loanItemId: 21,
      borrower: { id: 7, name: 'Aino Virtanen' },
    });
    // Name only, no email.
    expect(res.body.currentLoan.borrower).not.toHaveProperty('email');
  });

  it('admins see the borrower too', async () => {
    const res = await getChair('ADMIN');
    expect(res.body.currentLoan.borrower).toEqual({ id: 7, name: 'Aino Virtanen' });
  });

  it('a not yet returned item still shows its loan', async () => {
    prisma.loanItem.findFirst.mockResolvedValue({
      id: 21,
      status: 'OVERDUE',
      loan: { id: 5, dueAt: new Date(), toRoomId: D751.id, user: { id: 7, name: 'Aino Virtanen' } },
    });
    const res = await getChair('USER');
    expect(res.body.currentLoan.status).toBe('OVERDUE');
  });

  it('looks only for loans that hold the item now', async () => {
    await getChair('USER');
    expect(prisma.loanItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemId: 11, status: { in: ['APPROVED', 'OVERDUE'] } } }),
    );
  });

  it('an item that is not on loan has no current loan', async () => {
    prisma.item.findUnique.mockResolvedValue(chair({ onLoan: false }));
    const res = await getChair('USER');
    expect(res.body.currentLoan).toBeNull();
    expect(prisma.loanItem.findFirst).not.toHaveBeenCalled();
  });

  it('keeps the M7 creator', async () => {
    const res = await getChair('MODERATOR');
    expect(res.body.createdBy).toEqual({ id: 3, name: 'Mikko Laine' });
  });
});
