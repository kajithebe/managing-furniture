// The work of the reminders job (MF-20). jobs/reminders.js calls these every 5 minutes.
// The rules (who gets what, and when) are in reminderRules.js.
import { prisma } from '../db.js';
import { reminderMail } from '../mail/reminder.js';
import { sendMail } from './mailService.js';
import { groupForEmail, isPastDue, needsReminder } from './reminderRules.js';

const MINUTE = 60 * 1000;

// What the emails need about a loan item: its code, category and home room, and the loan's
// due time and borrower.
const emailFields = {
  id: true,
  loanId: true,
  status: true,
  decidedAt: true,
  reminderSentAt: true,
  lastOverdueEmailAt: true,
  item: {
    select: {
      code: true,
      category: { select: { name: true } },
      homeRoom: { select: { id: true, name: true } },
    },
  },
  loan: { select: { dueAt: true, createdAt: true, user: { select: { email: true } } } },
};

// Past due → "Not yet returned" (LoanItem OVERDUE). The item stays where it is: only the
// loan item's status changes, and one OVERDUE history event is written per item, without a
// user because the system made the change. Returns how many items became late.
export async function markOverdue(now = new Date()) {
  const candidates = await prisma.loanItem.findMany({
    where: { status: 'APPROVED', loan: { dueAt: { lte: now } } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      loanId: true,
      status: true,
      itemId: true,
      loan: { select: { dueAt: true } },
    },
  });

  let marked = 0;
  for (const loanItem of candidates.filter((li) => isPastDue(li, now))) {
    await prisma.$transaction(async (tx) => {
      // Only an item that is still APPROVED changes, so an item the borrower scans back at
      // the same moment stays RETURNED (returnService uses the same kind of check).
      const { count } = await tx.loanItem.updateMany({
        where: { id: loanItem.id, status: 'APPROVED' },
        data: { status: 'OVERDUE' },
      });
      if (count === 0) {
        return;
      }
      await tx.itemEvent.create({
        data: { itemId: loanItem.itemId, type: 'OVERDUE', loanId: loanItem.loanId },
      });
      marked += 1;
    });
  }
  return marked;
}

// Saves `field` = now on the group's loan items before the email is sent, but only on items
// where it still has the value the job read. So two runs (or a restart in the middle) never
// send the same email twice. Returns false when another run was quicker.
async function claim(loanItemIds, field, before, now) {
  const { count } = await prisma.loanItem.updateMany({
    where: { id: { in: loanItemIds }, [field]: before },
    data: { [field]: now },
  });
  return count > 0;
}

// After a failed send: put the old value back, so the next run (5 minutes later) tries again.
async function unclaim(loanItemIds, field, before, now) {
  await prisma.loanItem.updateMany({
    where: { id: { in: loanItemIds }, [field]: now },
    data: { [field]: before },
  });
}

// Email 3: "Time to bring your furniture back", [reminderMinutes] before the due time.
// One email per loan and home room. Returns how many emails were sent.
export async function sendReminders(now, { reminderMinutes }) {
  const candidates = await prisma.loanItem.findMany({
    where: {
      status: 'APPROVED',
      reminderSentAt: null,
      loan: { dueAt: { gt: now, lte: new Date(now.getTime() + reminderMinutes * MINUTE) } },
    },
    orderBy: { id: 'asc' },
    select: emailFields,
  });
  const groups = groupForEmail(candidates.filter((li) => needsReminder(li, now, reminderMinutes)));

  let sent = 0;
  for (const group of groups) {
    if (!(await claim(group.loanItemIds, 'reminderSentAt', null, now))) {
      continue;
    }
    try {
      const mail = reminderMail({
        loanId: group.loanId,
        homeRoom: group.homeRoom,
        dueAt: group.dueAt,
        items: group.items,
      });
      await sendMail({ to: group.email, ...mail });
      sent += 1;
    } catch (err) {
      await unclaim(group.loanItemIds, 'reminderSentAt', null, now);
      // No address or content in the log (02 › Security).
      console.error(`Reminder for loan ${group.loanId} could not be sent: ${err.message}`);
    }
  }
  return sent;
}
