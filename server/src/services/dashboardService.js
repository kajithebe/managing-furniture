// Moderator dashboard (MF-31, M1). Everything on the page comes from one call, so the numbers
// on the tiles and in the lists are taken at the same moment. No campus filter (01 › Scope).
import { prisma } from '../db.js';

// M1 number tiles. Each count matches the list that the tile opens:
// - Waiting for approval: items waiting for a moderator (same number as "Requests" in the menu)
// - Not yet returned: items past their until-time (LoanItem OVERDUE, set by the MF-20 job)
// - On loan now: items that are out of their home room on a loan
// - Total items: every item except Disposed, because the items list hides Disposed by default
async function countTiles() {
  const [waitingForApproval, notYetReturned, onLoanNow, totalItems] = await Promise.all([
    prisma.loanItem.count({ where: { status: 'PENDING' } }),
    prisma.loanItem.count({ where: { status: 'OVERDUE' } }),
    prisma.item.count({ where: { onLoan: true } }),
    prisma.item.count({ where: { condition: { not: 'DISPOSED' } } }),
  ]);
  return { waitingForApproval, notYetReturned, onLoanNow, totalItems };
}

// GET /api/moderator/dashboard. updatedAt is shown as "Updated 10:15 · Refresh".
export async function getDashboard(now = new Date()) {
  const tiles = await countTiles();
  return { updatedAt: now.toISOString(), tiles };
}
