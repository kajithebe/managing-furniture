// GET and POST /api/moderator/loan-items/:id/contact (MF-23, P11): "Email borrower".
// The database and the email sending are mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    loanItem: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../src/services/mailService.js', () => ({ sendMail: vi.fn() }));

const { prisma } = await import('../src/db.js');
const { sendMail } = await import('../src/services/mailService.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';

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

// LoanItem 31: Chair MP-00126, due back in D569 at 14:00 Helsinki time, borrowed by Aino.
function loanItemRow(status = 'OVERDUE') {
  return {
    id: 31,
    status,
    item: { code: 'MP-00126', category: { name: 'Chair' }, homeRoom: { name: 'D569' } },
    loan: {
      dueAt: new Date('2026-11-09T12:00:00Z'),
      user: { email: 'aino.virtanen@metropolia.fi' },
    },
  };
}

const preview = (id, role = 'MODERATOR') =>
  request(createApp()).get(`/api/moderator/loan-items/${id}/contact`).set('Cookie', loginAs(role));

const send = (id, role = 'MODERATOR') =>
  request(createApp())
    .post(`/api/moderator/loan-items/${id}/contact`)
    .set('Origin', ORIGIN)
    .set('Cookie', loginAs(role))
    .send({});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loanItem.findUnique.mockResolvedValue(loanItemRow());
  prisma.loanItem.update.mockResolvedValue({});
  sendMail.mockResolvedValue();
});

describe('GET /api/moderator/loan-items/:id/contact (P11 preview)', () => {
  it('needs a session and the moderator role', async () => {
    const noSession = await request(createApp()).get('/api/moderator/loan-items/31/contact');
    expect(noSession.status).toBe(401);

    const student = await preview(31, 'USER');
    expect(student.status).toBe(403);
  });

  it('shows the P11 email: To, subject and text', async () => {
    const res = await preview(31);

    expect(res.status).toBe(200);
    expect(res.body.to).toBe('aino.virtanen@metropolia.fi');
    expect(res.body.subject).toBe('1 item is not yet returned');
    expect(res.body.text).toContain(
      "Chair MP-00126 was due back in D569 at 14:00 and hasn't been scanned in yet. Please return it as soon as you can. If you already did, reply to this email and a moderator will check.",
    );
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('POST /api/moderator/loan-items/:id/contact (P11 Send email)', () => {
  it('is not for students', async () => {
    const res = await send(31, 'USER');
    expect(res.status).toBe(403);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('emails the borrower and saves Last contacted', async () => {
    const res = await send(31);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 31, lastContactedAt: expect.any(String) });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('aino.virtanen@metropolia.fi');
    expect(mail.subject).toBe('1 item is not yet returned');
    expect(mail.html).toContain('MP-00126');
    // A moderator's own email has no hidden copies.
    expect(mail.bcc).toBeUndefined();

    expect(prisma.loanItem.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { lastContactedAt: expect.any(Date) },
    });
  });

  it('keeps Last contacted unchanged when the email cannot be sent', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMail.mockRejectedValue(new Error('SMTP down'));

    const res = await send(31);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({
      code: 'MAIL_FAILED',
      message: 'The email could not be sent. Please try again.',
    });
    expect(prisma.loanItem.update).not.toHaveBeenCalled();
    // The log names the loan item, never the address.
    expect(quiet.mock.calls[0][0]).not.toContain('aino');
    quiet.mockRestore();
  });

  it('refuses an item that was returned meanwhile', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(loanItemRow('RETURNED'));

    const res = await send(31);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'ALREADY_RETURNED',
      message: 'This item is already returned',
      itemCode: 'MP-00126',
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses an item that is not late', async () => {
    for (const status of ['APPROVED', 'PENDING', 'DECLINED']) {
      prisma.loanItem.findUnique.mockResolvedValue(loanItemRow(status));
      const res = await send(31);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({
        code: 'ITEM_NOT_LATE',
        message: "MP-00126 isn't late, so there is nothing to send",
      });
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('gives 404 for an unknown loan item', async () => {
    prisma.loanItem.findUnique.mockResolvedValue(null);
    const res = await send(999);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
