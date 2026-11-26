// The reminders job (MF-20): one run reads the settings once and does the three parts in
// order. The database, the services and the timer are mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: { setting: { findUniqueOrThrow: vi.fn() } },
}));

vi.mock('../src/services/reminderService.js', () => ({
  markOverdue: vi.fn(),
  sendReminders: vi.fn(),
  sendOverdueEmails: vi.fn(),
}));

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));

const { prisma } = await import('../src/db.js');
const { markOverdue, sendOverdueEmails, sendReminders } =
  await import('../src/services/reminderService.js');
const cron = (await import('node-cron')).default;
const { SCHEDULE, runReminderJob, startReminderJob } = await import('../src/jobs/reminders.js');

const NOW = new Date('2026-11-09T12:05:00Z');
const SETTING = { reminderMinutes: 30, repeatOverdueEmail: true, ccModeratorsOnOverdue: false };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.setting.findUniqueOrThrow.mockResolvedValue(SETTING);
  markOverdue.mockResolvedValue(0);
  sendReminders.mockResolvedValue(0);
  sendOverdueEmails.mockResolvedValue(0);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('runReminderJob', () => {
  it('reads the settings once and passes them on', async () => {
    await runReminderJob(NOW);

    expect(prisma.setting.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(markOverdue).toHaveBeenCalledWith(NOW);
    expect(sendReminders).toHaveBeenCalledWith(NOW, SETTING);
    expect(sendOverdueEmails).toHaveBeenCalledWith(NOW, SETTING);
  });

  it('marks late items before it sends the not yet returned emails', async () => {
    const order = [];
    markOverdue.mockImplementation(async () => order.push('mark') && 0);
    sendOverdueEmails.mockImplementation(async () => order.push('emails') && 0);

    await runReminderJob(NOW);

    expect(order).toEqual(['mark', 'emails']);
  });

  it('returns the counts and logs them when something happened', async () => {
    markOverdue.mockResolvedValue(2);
    sendReminders.mockResolvedValue(1);
    sendOverdueEmails.mockResolvedValue(1);

    expect(await runReminderJob(NOW)).toEqual({
      notYetReturned: 2,
      reminders: 1,
      overdueEmails: 1,
    });
    expect(console.info).toHaveBeenCalledWith(
      'Reminder job: 2 not yet returned, 1 reminder emails, 1 not yet returned emails',
    );
  });

  it('logs nothing when nothing happened', async () => {
    await runReminderJob(NOW);

    expect(console.info).not.toHaveBeenCalled();
  });

  it('skips a run while the previous one is still busy', async () => {
    let finish;
    markOverdue.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = runReminderJob(NOW);
    expect(await runReminderJob(NOW)).toBe(null);

    finish(0);
    await first;
    expect(prisma.setting.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('logs a failure and runs again next time', async () => {
    markOverdue.mockRejectedValueOnce(new Error('database down'));

    expect(await runReminderJob(NOW)).toBe(null);
    expect(console.error).toHaveBeenCalledWith('Reminder job failed: database down');

    expect(await runReminderJob(NOW)).not.toBe(null);
  });
});

describe('startReminderJob', () => {
  it('runs every 5 minutes', () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);

    expect(startReminderJob()).toBe(task);
    expect(SCHEDULE).toBe('*/5 * * * *');
    expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function), {
      name: 'reminders',
    });
  });
});
