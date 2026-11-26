// Not yet returned (MF-23, M4). Items whose until-time has passed and that are not back yet:
// LoanItem OVERDUE, set by the MF-20 reminders job. There is no "missing" status (01 › Rules).
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { notYetReturnedMail } from '../mail/notYetReturned.js';
import { AppError } from '../middleware/error.js';
import { toCsv } from '../utils/csv.js';
import { sendMail } from './mailService.js';

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

// The CSV holds every matching row, not only one page (same limit as the Inventory CSV).
export const OVERDUE_CSV_MAX_ROWS = 20000;

// Date and time in the app's time zone, in a form Excel sorts correctly: "2026-11-24 13:00".
function localDateTime(value) {
  return value
    .toLocaleString('sv-SE', {
      timeZone: env.TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
}

// The M9 "Not yet returned" columns, in the same order as on the screen. The item and the
// borrower are split into two cells each, so the file can be sorted and filtered in Excel.
const overdueColumns = [
  { header: 'Item', value: (row) => row.name },
  { header: 'Code', value: (row) => row.code },
  { header: 'Borrower', value: (row) => row.borrower.name },
  { header: 'Email', value: (row) => row.borrower.email },
  { header: 'Due', value: (row) => localDateTime(row.dueAt) },
  { header: 'Hours late', value: (row) => row.hoursLate },
  { header: 'Last known room', value: (row) => row.lastRoom.name },
  { header: 'Home room', value: (row) => row.homeRoom.name },
  // Empty when the borrower was never contacted ("—" on the screen).
  {
    header: 'Contacted',
    value: (row) => (row.lastContactedAt ? localDateTime(row.lastContactedAt) : null),
  },
];

// GET /api/reports/overdue?format=csv → the CSV file as text, with all matching rows in the
// chosen sort order. filters: as for listOverdue, without the page.
export async function overdueCsv(filters, now = new Date()) {
  const { data } = await listOverdue({ ...filters, page: 1, pageSize: OVERDUE_CSV_MAX_ROWS }, now);
  return toCsv(overdueColumns, data);
}

// What "Email borrower" needs about one loan item.
const contactFields = {
  id: true,
  status: true,
  item: {
    select: {
      code: true,
      category: { select: { name: true } },
      homeRoom: { select: { name: true } },
    },
  },
  loan: { select: { dueAt: true, user: { select: { email: true } } } },
};

// Only a not yet returned item can be emailed about. M4 lists only those, so the other
// cases happen only when the item changed meanwhile (e.g. it was scanned back).
async function findLateItem(loanItemId) {
  const loanItem = await prisma.loanItem.findUnique({
    where: { id: loanItemId },
    select: contactFields,
  });
  if (!loanItem) {
    throw new AppError(404, 'NOT_FOUND', 'Not found.');
  }
  const { code } = loanItem.item;
  if (loanItem.status === 'RETURNED') {
    throw new AppError(409, 'ALREADY_RETURNED', 'This item is already returned', {
      itemCode: code,
    });
  }
  if (loanItem.status !== 'OVERDUE') {
    throw new AppError(409, 'ITEM_NOT_LATE', `${code} isn't late, so there is nothing to send`, {
      itemCode: code,
    });
  }
  return loanItem;
}

// P11 shows the same email the reminders job sends at the due time ("1 item is not yet
// returned … If you already did, reply to this email and a moderator will check."), so the
// borrower gets the same words from the moderator and from the job.
function contactMail(loanItem) {
  return notYetReturnedMail({
    homeRoom: loanItem.item.homeRoom.name,
    dueAt: loanItem.loan.dueAt,
    items: [{ code: loanItem.item.code, categoryName: loanItem.item.category.name }],
  });
}

// GET /api/moderator/loan-items/:id/contact – the P11 read-only preview
// → { to, subject, message }. P11 shows only the message under the subject, so the title
// line, the "Open my loans" link and the footer of the plain-text email are left out.
// The plain text is built as: title, message, link, footer, with a blank line between them.
export async function contactPreview(loanItemId) {
  const loanItem = await findLateItem(loanItemId);
  const { subject, text } = contactMail(loanItem);
  const message = text.split('\n\n').slice(1, -2).join('\n\n');
  return { to: loanItem.loan.user.email, subject, message };
}

// POST /api/moderator/loan-items/:id/contact – P11 "Send email": emails the borrower about one
// item and saves the time as "Last contacted" (lastContactedAt) → { id, lastContactedAt }.
// The time is saved only when the email was sent.
export async function contactBorrower(loanItemId, now = new Date()) {
  const loanItem = await findLateItem(loanItemId);

  try {
    await sendMail({ to: loanItem.loan.user.email, ...contactMail(loanItem) });
  } catch (err) {
    // The loan item id only: never the address or the email text in the log.
    console.error(`Email borrower for loan item ${loanItem.id} could not be sent: ${err.message}`);
    throw new AppError(503, 'MAIL_FAILED', 'The email could not be sent. Please try again.');
  }

  await prisma.loanItem.update({
    where: { id: loanItem.id },
    data: { lastContactedAt: now },
  });
  return { id: loanItem.id, lastContactedAt: now };
}
