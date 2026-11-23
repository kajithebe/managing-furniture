// Moderator dashboard (MF-31, M1). Everything on the page comes from one call, so the numbers
// on the tiles and in the lists are taken at the same moment. No campus filter (01 › Scope).
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { startOfToday } from './approvalService.js';
import { roomsById } from './loanService.js';

// The "Waiting for approval" and "Not yet returned" lists show 5 rows each (01 › Dashboard).
export const LIST_SIZE = 5;

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

// Midnight at the start of tomorrow in TZ. Asking for "today" 26 h after midnight always lands
// on tomorrow, also on the days when the clocks change (23 h or 25 h days).
function startOfTomorrow(now) {
  const today = startOfToday(env.TZ, now);
  return startOfToday(env.TZ, new Date(today.getTime() + 26 * 60 * 60 * 1000));
}

// The fields every dashboard list needs: the item ("Table MP-02210"), the borrower's name
// (no email on M1) and the loan, so a row can open the loan detail (M3).
const listRowSelect = {
  id: true,
  item: {
    select: {
      code: true,
      name: true,
      category: { select: { name: true } },
      currentRoom: { select: { id: true, name: true } },
    },
  },
  loan: {
    select: { id: true, dueAt: true, toRoomId: true, user: { select: { id: true, name: true } } },
  },
};

function listRow(loanItem) {
  const { item, loan } = loanItem;
  return {
    id: loanItem.id,
    loanId: loan.id,
    code: item.code,
    name: item.name,
    category: item.category.name,
    borrower: loan.user,
    dueAt: loan.dueAt,
  };
}

// The three M1 lists:
// - waiting: the 5 items waiting longest for approval (oldest request first), "To" and "Until"
// - overdue: the 5 items that are late the longest (earliest until-time first); "Last room" is
//   the item's current room, because a late item has not been scanned back yet
// - dueToday: items on loan that are due between now and midnight, soonest first
async function loadLists(now) {
  const [waiting, overdue, dueToday] = await Promise.all([
    prisma.loanItem.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ loan: { createdAt: 'asc' } }, { id: 'asc' }],
      take: LIST_SIZE,
      select: listRowSelect,
    }),
    prisma.loanItem.findMany({
      where: { status: 'OVERDUE' },
      orderBy: [{ loan: { dueAt: 'asc' } }, { id: 'asc' }],
      take: LIST_SIZE,
      select: listRowSelect,
    }),
    prisma.loanItem.findMany({
      where: { status: 'APPROVED', loan: { dueAt: { gte: now, lt: startOfTomorrow(now) } } },
      orderBy: [{ loan: { dueAt: 'asc' } }, { id: 'asc' }],
      select: listRowSelect,
    }),
  ]);

  // Loan.toRoomId has no relation in the schema, so the rooms are read in one extra query.
  const rooms = await roomsById(waiting.map((row) => row.loan.toRoomId));

  return {
    waiting: waiting.map((row) => ({ ...listRow(row), toRoom: rooms.get(row.loan.toRoomId) })),
    overdue: overdue.map((row) => ({ ...listRow(row), lastRoom: row.item.currentRoom })),
    dueToday: dueToday.map(listRow),
  };
}

// GET /api/moderator/dashboard. updatedAt is shown as "Updated 10:15 · Refresh".
export async function getDashboard(now = new Date()) {
  const [tiles, lists] = await Promise.all([countTiles(), loadLists(now)]);
  return { updatedAt: now.toISOString(), tiles, ...lists };
}
