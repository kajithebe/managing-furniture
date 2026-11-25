// The reminders job (MF-20): every 5 minutes, marks late items "not yet returned" and sends
// the reminder (email 3) and the "not yet returned" emails (emails 4 and 5).
// server.js starts it; tests call runReminderJob directly, so no timer runs in tests.
// What happens in each run is decided in services/reminderService.js and reminderRules.js.
import cron from 'node-cron';
import { prisma } from '../db.js';
import { markOverdue, sendOverdueEmails, sendReminders } from '../services/reminderService.js';

export const SCHEDULE = '*/5 * * * *'; // every 5 minutes

let running = false;

// One run. The settings are read once, so the whole run uses the same values.
// Order: first mark late items, so an item that became late now gets its first email in the
// same run. Returns the counts, or null when the run was skipped or failed.
export async function runReminderJob(now = new Date()) {
  // A slow run (e.g. a slow mail server) must not overlap the next one.
  if (running) {
    return null;
  }
  running = true;
  try {
    const setting = await prisma.setting.findUniqueOrThrow({
      where: { id: 1 },
      select: { reminderMinutes: true, repeatOverdueEmail: true, ccModeratorsOnOverdue: true },
    });
    const notYetReturned = await markOverdue(now);
    const reminders = await sendReminders(now, setting);
    const overdueEmails = await sendOverdueEmails(now, setting);

    if (notYetReturned + reminders + overdueEmails > 0) {
      console.info(
        `Reminder job: ${notYetReturned} not yet returned, ${reminders} reminder emails, ` +
          `${overdueEmails} not yet returned emails`,
      );
    }
    return { notYetReturned, reminders, overdueEmails };
  } catch (err) {
    // The next run tries again in 5 minutes; the server keeps running.
    console.error(`Reminder job failed: ${err.message}`);
    return null;
  } finally {
    running = false;
  }
}

// Starts the timer. Returns the task, so server.js can stop it on shutdown.
export function startReminderJob() {
  return cron.schedule(SCHEDULE, () => runReminderJob(), { name: 'reminders' });
}
