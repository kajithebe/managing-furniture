// The work of the reminders job (MF-20). jobs/reminders.js calls these every 5 minutes.
// The rules (who gets what, and when) are in reminderRules.js.
import { prisma } from '../db.js';
import { isPastDue } from './reminderRules.js';

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
