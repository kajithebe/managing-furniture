// Not yet returned (MF-23, M4). Items whose until-time has passed and that are not back yet:
// LoanItem OVERDUE, set by the MF-20 reminders job. There is no "missing" status (01 › Rules).
import { prisma } from '../db.js';

const HOUR = 60 * 60 * 1000;

// The sort arrows on M4, in the order of the columns.
export const OVERDUE_SORT_COLUMNS = [
  'item',
  'borrower',
  'due',
  'lateBy',
  'lastRoom',
  'homeRoom',
  'lastContacted',
];

// The id is always added last, so rows with the same value keep a stable order across pages.
// "Late by" is the due time the other way round: the item that is late the longest has the
// earliest due time. "Last contacted": items never contacted ("—") sort last.
function orderBy(sort, order) {
  const reverse = order === 'asc' ? 'desc' : 'asc';
  const columns = {
    item: [{ item: { code: order } }],
    borrower: [{ loan: { user: { name: { sort: order, nulls: 'last' } } } }],
    due: [{ loan: { dueAt: order } }],
    lateBy: [{ loan: { dueAt: reverse } }],
    lastRoom: [{ item: { currentRoom: { name: order } } }],
    homeRoom: [{ item: { homeRoom: { name: order } } }],
    lastContacted: [{ lastContactedAt: { sort: order, nulls: 'last' } }],
  };
  return [...columns[sort], { id: 'asc' }];
}

// The M4 filters. Room matches the last known room or the home room, the same rule as the
// Room filter of the items list (MF-08), so a room gives the same items on every page.
function overdueWhere({ category, room }) {
  const conditions = [{ status: 'OVERDUE' }];
  if (category) {
    conditions.push({ item: { categoryId: category } });
  }
  if (room) {
    conditions.push({ item: { OR: [{ currentRoomId: room }, { homeRoomId: room }] } });
  }
  return { AND: conditions };
}

// What one M4 row shows: "Chair MP-00126", the borrower's name and email (moderators only,
// 01 › Reports), the due time, the last known room (the item's current room, because a late
// item has not been scanned back yet), the home room and when the borrower was last emailed.
const rowFields = {
  id: true,
  lastContactedAt: true,
  item: {
    select: {
      code: true,
      name: true,
      category: { select: { name: true } },
      currentRoom: { select: { id: true, name: true } },
      homeRoom: { select: { id: true, name: true } },
    },
  },
  loan: {
    select: {
      id: true,
      dueAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
};

// "Late by 26 h": full hours since the due time. The server works it out, so the page and the
// CSV always show the same number.
export function hoursLate(dueAt, now) {
  return Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / HOUR));
}

function toRow(loanItem, now) {
  const { item, loan } = loanItem;
  return {
    id: loanItem.id,
    loanId: loan.id,
    code: item.code,
    name: item.name,
    category: item.category.name,
    borrower: loan.user,
    dueAt: loan.dueAt,
    hoursLate: hoursLate(loan.dueAt, now),
    lastRoom: item.currentRoom,
    homeRoom: item.homeRoom,
    lastContactedAt: loanItem.lastContactedAt,
  };
}

// GET /api/moderator/overdue (M4) → { data, total, notYetReturned }.
// `total` counts the rows that match the filters ("Showing 1–25 of 312"); `notYetReturned`
// counts all not yet returned items, for the "2 items are not yet returned" message and the
// side menu badge, like `waitingItems` on M2.
// query: { category, room, sort, order, page, pageSize }, already validated by the route.
export async function listOverdue(query, now = new Date()) {
  const { sort, order, page, pageSize } = query;
  const where = overdueWhere(query);

  const [rows, total, notYetReturned] = await Promise.all([
    prisma.loanItem.findMany({
      where,
      orderBy: orderBy(sort, order),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: rowFields,
    }),
    prisma.loanItem.count({ where }),
    prisma.loanItem.count({ where: { status: 'OVERDUE' } }),
  ]);

  return { data: rows.map((row) => toRow(row, now)), total, notYetReturned };
}
