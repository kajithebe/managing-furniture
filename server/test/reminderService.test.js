// The reminders job's work (MF-20). The database is mocked, so these tests run anywhere.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    loanItem: { findMany: vi.fn(), updateMany: vi.fn() },
    itemEvent: { create: vi.fn() },
    user: { findMany: vi.fn() },
  };
  // The transaction callback gets the same mocked client.
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  return { prisma };
});

vi.mock('../src/services/mailService.js', () => ({ sendMail: vi.fn() }));

const { prisma } = await import('../src/db.js');
const { sendMail } = await import('../src/services/mailService.js');
const { markOverdue, sendOverdueEmails, sendReminders } =
  await import('../src/services/reminderService.js');

const NOW = new Date('2026-11-09T12:05:00Z');
const DUE = new Date('2026-11-09T12:00:00Z');

function row(id, overrides = {}) {
  return {
    id,
    loanId: 5,
    status: 'APPROVED',
    itemId: id + 100,
    loan: { dueAt: DUE },
    ...overrides,
  };
}

const D569 = { id: 1, name: 'D569' };
const AINO = 'aino.virtanen@metropolia.fi';

// A chair or table of loan 5, borrowed by Aino at 10:00 and due at 14:00.
function emailRow(id, code, category = 'Chair', overrides = {}) {
  return {
    id,
    loanId: 5,
    status: 'APPROVED',
    decidedAt: null,
    reminderSentAt: null,
    lastOverdueEmailAt: null,
    item: { code, category: { name: category }, homeRoom: D569 },
    loan: {
      dueAt: DUE,
      createdAt: new Date('2026-11-09T08:00:00Z'),
      user: { email: AINO },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loanItem.updateMany.mockResolvedValue({ count: 1 });
  sendMail.mockResolvedValue();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('markOverdue', () => {
  it('asks only for items on loan whose due time has passed', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    await markOverdue(NOW);

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'APPROVED', loan: { dueAt: { lte: NOW } } } }),
    );
  });

  it('marks late items OVERDUE and writes one OVERDUE event each', async () => {
    prisma.loanItem.findMany.mockResolvedValue([row(21), row(22)]);

    const marked = await markOverdue(NOW);

    expect(marked).toBe(2);
    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: 21, status: 'APPROVED' },
      data: { status: 'OVERDUE' },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledWith({
      data: { itemId: 121, type: 'OVERDUE', loanId: 5 },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledTimes(2);
  });

  it('leaves an item alone that was returned at the same moment', async () => {
    prisma.loanItem.findMany.mockResolvedValue([row(21)]);
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });

    const marked = await markOverdue(NOW);

    expect(marked).toBe(0);
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('does nothing when no item is late', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    expect(await markOverdue(NOW)).toBe(0);
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });
});

describe('sendReminders', () => {
  const REMINDER_NOW = new Date('2026-11-09T11:35:00Z'); // 13:35, 25 min before 14:00

  it('asks only for items on loan without a reminder, due within the reminder time', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    await sendReminders(REMINDER_NOW, { reminderMinutes: 30 });

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'APPROVED',
          reminderSentAt: null,
          loan: { dueAt: { gt: REMINDER_NOW, lte: new Date('2026-11-09T12:05:00Z') } },
        },
      }),
    );
  });

  it('sends one email 3 per loan and home room and saves the time first', async () => {
    prisma.loanItem.findMany.mockResolvedValue([
      emailRow(21, 'MP-00123'),
      emailRow(22, 'MP-02210', 'Table'),
    ]);

    const sent = await sendReminders(REMINDER_NOW, { reminderMinutes: 30 });

    expect(sent).toBe(1);
    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [21, 22] }, reminderSentAt: null },
      data: { reminderSentAt: REMINDER_NOW },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('aino.virtanen@metropolia.fi');
    expect(mail.subject).toBe('Reminder: return 2 items to D569 by 14:00');
    expect(mail.text).toContain('• Chair MP-00123');
    expect(mail.text).toContain('• Table MP-02210');
    expect(mail.text).toContain('http://localhost:5173/return/5');
  });

  it('skips a short loan that went on loan inside the reminder time', async () => {
    prisma.loanItem.findMany.mockResolvedValue([
      emailRow(21, 'MP-00123', 'Chair', { decidedAt: new Date('2026-11-09T11:40:00Z') }),
    ]);

    const sent = await sendReminders(new Date('2026-11-09T11:45:00Z'), { reminderMinutes: 30 });

    expect(sent).toBe(0);
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends nothing when another run already saved the reminder', async () => {
    prisma.loanItem.findMany.mockResolvedValue([emailRow(21, 'MP-00123')]);
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });

    expect(await sendReminders(REMINDER_NOW, { reminderMinutes: 30 })).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('clears the saved time when the email fails, so the next run tries again', async () => {
    prisma.loanItem.findMany.mockResolvedValue([emailRow(21, 'MP-00123')]);
    sendMail.mockRejectedValue(new Error('SMTP down'));

    const sent = await sendReminders(REMINDER_NOW, { reminderMinutes: 30 });

    expect(sent).toBe(0);
    expect(prisma.loanItem.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: [21] }, reminderSentAt: REMINDER_NOW },
      data: { reminderSentAt: null },
    });
    expect(console.error).toHaveBeenCalledWith('Reminder for loan 5 could not be sent: SMTP down');
  });
});

describe('sendOverdueEmails', () => {
  const HOUR = 60 * 60 * 1000;
  const LATE_NOW = new Date('2026-11-09T12:05:00Z'); // 14:05, 5 min after 14:00
  const ON = { repeatOverdueEmail: true, ccModeratorsOnOverdue: false };

  function lateRow(id, code, lastOverdueEmailAt = null, category = 'Chair') {
    return emailRow(id, code, category, { status: 'OVERDUE', lastOverdueEmailAt });
  }

  it('asks for late items without an email, or with the last one 24 h ago', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    await sendOverdueEmails(LATE_NOW, ON);

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'OVERDUE',
          OR: [
            { lastOverdueEmailAt: null },
            { lastOverdueEmailAt: { lte: new Date(LATE_NOW.getTime() - 24 * HOUR) } },
          ],
        },
      }),
    );
  });

  it('asks only for items without an email when the repeat setting is off', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    await sendOverdueEmails(LATE_NOW, { ...ON, repeatOverdueEmail: false });

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OVERDUE', OR: [{ lastOverdueEmailAt: null }] },
      }),
    );
  });

  it('sends email 4 at the due time and saves the time first', async () => {
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126')]);

    const sent = await sendOverdueEmails(LATE_NOW, ON);

    expect(sent).toBe(1);
    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [21] }, lastOverdueEmailAt: null },
      data: { lastOverdueEmailAt: LATE_NOW },
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe(AINO);
    expect(mail.bcc).toEqual([]);
    expect(mail.subject).toBe('1 item is not yet returned');
    expect(mail.text).toContain('Chair MP-00126 was due back in D569 at 14:00');
  });

  it('sends email 5 when the last email was 24 h ago', async () => {
    const lastEmail = new Date(LATE_NOW.getTime() - 24 * HOUR);
    const now = new Date(LATE_NOW.getTime() + 5 * 60 * 1000);
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126', lastEmail)]);

    const sent = await sendOverdueEmails(now, ON);

    expect(sent).toBe(1);
    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [21] },
        lastOverdueEmailAt: { lte: new Date(now.getTime() - 24 * HOUR) },
      },
      data: { lastOverdueEmailAt: now },
    });
    expect(sendMail.mock.calls[0][0].subject).toBe(
      'Still not returned: Chair MP-00126 (due 9 Nov)',
    );
  });

  it('sends the first and the repeat email separately', async () => {
    const now = new Date(LATE_NOW.getTime() + 25 * HOUR);
    prisma.loanItem.findMany.mockResolvedValue([
      lateRow(21, 'MP-00126', LATE_NOW),
      lateRow(22, 'MP-02210', null, 'Table'),
    ]);

    expect(await sendOverdueEmails(now, ON)).toBe(2);
    expect(sendMail.mock.calls.map(([mail]) => mail.subject)).toEqual([
      '1 item is not yet returned',
      'Still not returned: Chair MP-00126 (due 9 Nov)',
    ]);
  });

  it('puts every active moderator and admin in Bcc when the copy setting is on', async () => {
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126')]);
    prisma.user.findMany.mockResolvedValue([
      { email: 'mikko.laine@metropolia.fi' },
      { email: 'first.admin@metropolia.fi' },
    ]);

    await sendOverdueEmails(LATE_NOW, { ...ON, ccModeratorsOnOverdue: true });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, role: { in: ['MODERATOR', 'ADMIN'] } },
      }),
    );
    expect(sendMail.mock.calls[0][0].bcc).toEqual([
      'mikko.laine@metropolia.fi',
      'first.admin@metropolia.fi',
    ]);
  });

  it('never puts the borrower in Bcc of their own email', async () => {
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126')]);
    prisma.user.findMany.mockResolvedValue([
      { email: AINO },
      { email: 'mikko.laine@metropolia.fi' },
    ]);

    await sendOverdueEmails(LATE_NOW, { ...ON, ccModeratorsOnOverdue: true });

    expect(sendMail.mock.calls[0][0].bcc).toEqual(['mikko.laine@metropolia.fi']);
  });

  it('does not look up moderators when the copy setting is off', async () => {
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126')]);

    await sendOverdueEmails(LATE_NOW, ON);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('sends nothing when another run already saved the email', async () => {
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126')]);
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });

    expect(await sendOverdueEmails(LATE_NOW, ON)).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('clears the saved time when the first email fails', async () => {
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126')]);
    sendMail.mockRejectedValue(new Error('SMTP down'));

    expect(await sendOverdueEmails(LATE_NOW, ON)).toBe(0);
    expect(prisma.loanItem.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: [21] }, lastOverdueEmailAt: LATE_NOW },
      data: { lastOverdueEmailAt: null },
    });
    expect(console.error).toHaveBeenCalledWith(
      'Not yet returned email for loan 5 could not be sent: SMTP down',
    );
  });

  it('makes a failed repeat email due again on the next run', async () => {
    const now = new Date(LATE_NOW.getTime() + 24 * HOUR);
    prisma.loanItem.findMany.mockResolvedValue([lateRow(21, 'MP-00126', LATE_NOW)]);
    sendMail.mockRejectedValue(new Error('SMTP down'));

    expect(await sendOverdueEmails(now, ON)).toBe(0);
    expect(prisma.loanItem.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: [21] }, lastOverdueEmailAt: now },
      data: { lastOverdueEmailAt: new Date(now.getTime() - 24 * HOUR) },
    });
  });
});
