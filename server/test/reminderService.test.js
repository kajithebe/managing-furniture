// The reminders job's work (MF-20). The database is mocked, so these tests run anywhere.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    loanItem: { findMany: vi.fn(), updateMany: vi.fn() },
    itemEvent: { create: vi.fn() },
  };
  // The transaction callback gets the same mocked client.
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  return { prisma };
});

vi.mock('../src/services/mailService.js', () => ({ sendMail: vi.fn() }));

const { prisma } = await import('../src/db.js');
const { sendMail } = await import('../src/services/mailService.js');
const { markOverdue, sendReminders } = await import('../src/services/reminderService.js');

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
  const D569 = { id: 1, name: 'D569' };

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
        user: { email: 'aino.virtanen@metropolia.fi' },
      },
      ...overrides,
    };
  }

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
