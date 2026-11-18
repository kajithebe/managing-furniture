// POST /api/moderator/loan-items/:id/approve and /decline (MF-10): M2 actions, P10 Decline
// pop-up and email 2. The database and the mail service are mocked.
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    loanItem: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    item: { updateMany: vi.fn() },
    itemEvent: { create: vi.fn() },
    loan: { update: vi.fn() },
    room: { findMany: vi.fn() },
  };
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  return { prisma };
});
vi.mock('../src/services/mailService.js', () => ({ sendMail: vi.fn() }));

const { prisma } = await import('../src/db.js');
const { sendMail } = await import('../src/services/mailService.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
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

// The table from M2 / P10: waiting in Aino's request from D569 to D751.
function waitingTable(overrides = {}) {
  return {
    id: 23,
    status: 'PENDING',
    fromRoomId: D569.id,
    loan: {
      id: 5,
      reason: 'Group work',
      dueAt: new Date('2026-11-09T12:00:00Z'),
      toRoomId: D751.id,
      user: { email: 'aino.virtanen@metropolia.fi', name: 'Aino Virtanen' },
    },
    item: {
      id: 12,
      code: 'MP-02210',
      name: 'Table',
      onLoan: false,
      condition: 'GOOD',
      homeRoomId: D569.id,
      category: { name: 'Table' },
    },
    ...overrides,
  };
}

function decide(action, body = {}, role = 'MODERATOR') {
  return request(createApp())
    .post(`/api/moderator/loan-items/23/${action}`)
    .set('Origin', ORIGIN)
    .set('Cookie', loginAs(role))
    .send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loanItem.findUnique.mockResolvedValue(waitingTable());
  prisma.loanItem.updateMany.mockResolvedValue({ count: 1 });
  prisma.loanItem.count.mockResolvedValue(4);
  prisma.item.updateMany.mockResolvedValue({ count: 1 });
  prisma.itemEvent.create.mockResolvedValue({});
  prisma.loan.update.mockResolvedValue({});
  prisma.room.findMany.mockResolvedValue([D569, D751]);
  sendMail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('access', () => {
  it('needs a session', async () => {
    const res = await request(createApp())
      .post('/api/moderator/loan-items/23/approve')
      .set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await decide('approve', {}, 'USER');
    expect(res.status).toBe(403);
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });
});

describe('approve', () => {
  it('approves the table, moves it to D751 and emails the borrower', async () => {
    const res = await decide('approve');

    expect(res.status).toBe(200);
    // For the toast "✓ Table MP-02210 approved".
    expect(res.body).toMatchObject({
      id: 23,
      status: 'APPROVED',
      code: 'MP-02210',
      category: 'Table',
      decidedBy: { id: 9, name: 'Mikko Laine' },
      note: null,
    });

    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: 23, status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', decidedById: 9, decisionNote: null }),
    });
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: 12, onLoan: false },
      data: { onLoan: true, currentRoomId: D751.id },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledWith({
      data: {
        itemId: 12,
        type: 'APPROVED',
        userId: 9,
        loanId: 5,
        fromRoomId: D569.id,
        toRoomId: D751.id,
        note: null,
      },
    });
    // An approved item keeps the loan open.
    expect(prisma.loan.update).not.toHaveBeenCalled();

    // Email 2, approved.
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('aino.virtanen@metropolia.fi');
    expect(mail.subject).toBe('Your table request is approved');
    expect(mail.text).toContain('D569 → D751 · Group work');
    expect(mail.text).toContain('Please bring it back to D569 by 14:00');
  });

  it('refuses when someone else borrowed the item meanwhile', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(
      waitingTable({ item: { ...waitingTable().item, onLoan: true } }),
    );
    const res = await decide('approve');
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'ITEM_NOT_AVAILABLE',
      message: 'One item was borrowed by someone else meanwhile: MP-02210',
      items: [{ code: 'MP-02210', status: 'ON_LOAN' }],
    });
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses when the item was taken at the same moment', async () => {
    prisma.item.updateMany.mockResolvedValue({ count: 0 });
    const res = await decide('approve');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_NOT_AVAILABLE');
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('decline', () => {
  it('declines with the note from P10; the other items stay approved', async () => {
    const res = await decide('decline', { note: '  Booked for an exam.  ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'DECLINED', note: 'Booked for an exam.' });

    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: 23, status: 'PENDING' },
      data: expect.objectContaining({ status: 'DECLINED', decisionNote: 'Booked for an exam.' }),
    });
    // A declined item does not move.
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
    expect(prisma.itemEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'DECLINED', fromRoomId: null, toRoomId: null }),
    });
    // 4 items are still open, so the loan stays open.
    expect(prisma.loan.update).not.toHaveBeenCalled();

    // Email 2, declined, with the note and the agreed plural wording.
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Your table request was declined');
    expect(mail.text).toContain('Note from Mikko Laine:');
    expect(mail.text).toContain('Booked for an exam.');
    expect(mail.text).toContain('4 other items in this request are still approved.');
  });

  it('closes the loan when its last open item is declined', async () => {
    prisma.loanItem.count.mockResolvedValue(0);
    const res = await decide('decline');
    expect(res.status).toBe(200);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'CLOSED', closedAt: expect.any(Date) },
    });
  });

  it('saves an empty note as no note', async () => {
    const res = await decide('decline', { note: '   ' });
    expect(res.body.note).toBeNull();
  });
});

describe('errors', () => {
  it('409 when the item was already decided', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(waitingTable({ status: 'APPROVED' }));
    const res = await decide('decline');
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'ALREADY_DECIDED',
      message: 'This item has already been approved or declined.',
    });
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });

  it('409 when another moderator decided it at the same moment', async () => {
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });
    const res = await decide('approve');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_DECIDED');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('404 for an unknown loan item', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(null);
    const res = await decide('approve');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('keeps the decision when the email cannot be sent', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMail.mockRejectedValue(new Error('Mailgun is down'));

    const res = await decide('approve');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    // The log names the loan item, never the borrower's address.
    expect(log).toHaveBeenCalledWith(expect.stringContaining('loan item 23'));
    expect(log.mock.calls[0][0]).not.toContain('aino.virtanen');
  });

  it.each([
    ['an id that is not a number', '/api/moderator/loan-items/abc/approve', {}],
    [
      'a note over 500 characters',
      '/api/moderator/loan-items/23/decline',
      { note: 'x'.repeat(501) },
    ],
  ])('400 for %s', async (label, path, body) => {
    const res = await request(createApp())
      .post(path)
      .set('Origin', ORIGIN)
      .set('Cookie', loginAs('MODERATOR'))
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
