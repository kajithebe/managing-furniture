// GET /api/moderator/loans/:id (M3 Loan detail): one whole loan with the borrower's email and
// every item's status, decision and return. The database is mocked.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    loan: { findUnique: vi.fn() },
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

function loanItem(id, code, category, overrides) {
  return {
    id,
    status: 'APPROVED',
    fromRoomId: D569.id,
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    returnedAt: null,
    returnedById: null,
    returnMethod: null,
    item: {
      code,
      name: category,
      category: { name: category },
      homeRoom: D569,
      currentRoom: D569,
    },
    ...overrides,
  };
}

// The M3 example: three chairs returned, one not yet returned, one table waiting.
const ainoLoan = {
  id: 5,
  status: 'OPEN',
  reason: 'Group work',
  createdAt: new Date('2026-11-09T07:58:00Z'),
  dueAt: new Date('2026-11-09T12:00:00Z'),
  closedAt: null,
  toRoomId: D751.id,
  user: { id: 7, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
  items: [
    loanItem(21, 'MP-00123', 'Chair', {
      status: 'RETURNED',
      returnedAt: new Date('2026-11-09T11:55:00Z'),
      returnedById: 7,
      returnMethod: 'SCAN',
    }),
    loanItem(22, 'MP-00125', 'Chair', {
      status: 'RETURNED',
      returnedAt: new Date('2026-11-09T11:56:00Z'),
      returnedById: 9,
      returnMethod: 'MODERATOR',
    }),
    loanItem(23, 'MP-00126', 'Chair', {
      status: 'OVERDUE',
      item: {
        code: 'MP-00126',
        name: 'Chair',
        category: { name: 'Chair' },
        homeRoom: D569,
        currentRoom: D751,
      },
    }),
    loanItem(24, 'MP-02210', 'Table', { status: 'PENDING' }),
    loanItem(25, 'MP-03015', 'Sofa', {
      status: 'DECLINED',
      decidedById: 9,
      decidedAt: new Date('2026-11-09T08:10:00Z'),
      decisionNote: 'Booked for an exam.',
    }),
  ],
};

function getLoan(id = 5, role = 'MODERATOR') {
  return request(createApp()).get(`/api/moderator/loans/${id}`).set('Cookie', loginAs(role));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loan.findUnique.mockResolvedValue(ainoLoan);
  prisma.room.findMany.mockResolvedValue([D569, D751]);
  prisma.user.findMany.mockResolvedValue([
    { id: 7, name: 'Aino Virtanen' },
    { id: 9, name: 'Mikko Laine' },
  ]);
});

describe('GET /api/moderator/loans/:id', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/moderator/loans/5');
    expect(res.status).toBe(401);
  });

  it('is not for students, so the borrower email stays with moderators', async () => {
    const res = await getLoan(5, 'USER');
    expect(res.status).toBe(403);
    expect(prisma.loan.findUnique).not.toHaveBeenCalled();
  });

  it('M3 header: borrower with email, reason, to, created, until', async () => {
    const res = await getLoan();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 5,
      status: 'OPEN',
      reason: 'Group work',
      createdAt: '2026-11-09T07:58:00.000Z',
      dueAt: '2026-11-09T12:00:00.000Z',
      closedAt: null,
      borrower: { id: 7, name: 'Aino Virtanen', email: 'aino.virtanen@metropolia.fi' },
      toRoom: D751,
    });
    expect(res.body.items).toHaveLength(5);
  });

  it('M3 table: home room, current room, status and from room per item', async () => {
    const res = await getLoan();
    expect(res.body.items[2]).toMatchObject({
      id: 23,
      code: 'MP-00126',
      category: 'Chair',
      status: 'OVERDUE',
      homeRoom: D569,
      currentRoom: D751,
      fromRoom: D569,
    });
  });

  it('"Decided by": auto-approved, a moderator, or nobody yet', async () => {
    const { items } = (await getLoan()).body;
    // Approved by its category.
    expect(items[0]).toMatchObject({ autoApproved: true, decidedBy: null });
    // Still waiting: "—".
    expect(items[3]).toMatchObject({ status: 'PENDING', autoApproved: false, decidedBy: null });
    // Declined by Mikko, with the note.
    expect(items[4]).toMatchObject({
      status: 'DECLINED',
      autoApproved: false,
      decidedBy: { id: 9, name: 'Mikko Laine' },
      note: 'Booked for an exam.',
    });
  });

  it('"Returned at / method": scanned, or marked by a moderator', async () => {
    const { items } = (await getLoan()).body;
    expect(items[0]).toMatchObject({
      returnedAt: '2026-11-09T11:55:00.000Z',
      returnMethod: 'SCAN',
    });
    expect(items[1]).toMatchObject({
      returnMethod: 'MODERATOR',
      returnedBy: { id: 9, name: 'Mikko Laine' },
    });
    // Not returned yet: "—".
    expect(items[2]).toMatchObject({ returnedAt: null, returnMethod: null, returnedBy: null });
  });

  it('404 for an unknown loan', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    const res = await getLoan(999);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400 for an id that is not a number', async () => {
    const res = await request(createApp())
      .get('/api/moderator/loans/abc')
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
