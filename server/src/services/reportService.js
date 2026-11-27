// Reports (01 › Reports, M9 in design-screens). Each report is a filtered table with a
// Download CSV button. Sprint 1 has the Inventory report; Sprint 2 adds Loans and Item history.
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { toCsv } from '../utils/csv.js';
import { startOfToday, usersById } from './approvalService.js';
import { splitNote } from './dashboardService.js';
import { listItems } from './itemService.js';
import { roomsById } from './loanService.js';

// The CSV holds every matching item, not only one page. 01 expects about 10,000 items at
// Karaportti, so this limit leaves room to grow while keeping one download reasonable.
export const INVENTORY_CSV_MAX_ROWS = 20000;

// Status words as on the badges (03 › Item status badges).
const STATUS_LABELS = {
  AVAILABLE: 'Available',
  ON_LOAN: 'On loan',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// The M9 columns, in the same order as on the screen.
const inventoryColumns = [
  { header: 'Code', value: (item) => item.code },
  { header: 'Category', value: (item) => item.category.name },
  { header: 'Name', value: (item) => item.name },
  { header: 'Brand', value: (item) => item.brand?.name },
  { header: 'Colour', value: (item) => item.colour?.name },
  // "No", or the number of wheels, as on M9.
  { header: 'Wheels', value: (item) => (item.hasWheels ? item.wheelCount : 'No') },
  { header: 'Home room', value: (item) => item.homeRoom.name },
  { header: 'Current room', value: (item) => item.currentRoom.name },
  { header: 'Status', value: (item) => STATUS_LABELS[item.status] },
];

// The report uses the same filters, sorting and status rules as the Items list (MF-08), so a
// filter gives the same items in both places. Disposed items are left out unless the Status
// filter is Disposed. Search is not part of this report.
function inventoryQuery(filters) {
  return { ...filters, showDisposed: false, q: undefined };
}

// GET /api/reports/inventory → { data, total } for one page of the table.
// filters: { category, campus, building, room, status, sort, order, page, pageSize },
// already validated by the route.
export function inventoryReport(filters) {
  return listItems(inventoryQuery(filters));
}

// GET /api/reports/inventory?format=csv → the CSV file as text, with all matching items
// in the chosen sort order.
export async function inventoryCsv(filters) {
  const { data } = await listItems({
    ...inventoryQuery(filters),
    page: 1,
    pageSize: INVENTORY_CSV_MAX_ROWS,
  });
  return toCsv(inventoryColumns, data);
}

// ---------- Loans report (MF-32) ----------

// "2026-11-20" → midnight at the start of that day in TZ, as a Date.
// 12:00 UTC is always on the same calendar day in Helsinki, so startOfToday finds that midnight.
export function startOfDay(dateText, timeZone = env.TZ) {
  return startOfToday(timeZone, new Date(`${dateText}T12:00:00Z`));
}

// "2026-11-20" → "2026-11-21". Used so the "to" day is included in full.
function nextDay(dateText) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Prisma filter for the Loans tab. All filters must match (AND).
// - from / to: the day the loan was requested (createdAt), both days included, in TZ.
// - category: the loan has at least one item of that category.
// - room: the room is the loan's target room, or the room one of its items came from.
// - status: the loan's own status, OPEN or CLOSED.
function loansWhere({ from, to, category, room, status }) {
  const and = [];
  if (from) and.push({ createdAt: { gte: startOfDay(from) } });
  if (to) and.push({ createdAt: { lt: startOfDay(nextDay(to)) } });
  if (status) and.push({ status });
  if (category) and.push({ items: { some: { item: { categoryId: category } } } });
  if (room) {
    and.push({ OR: [{ toRoomId: room }, { items: { some: { fromRoomId: room } } }] });
  }
  return { AND: and };
}

// What one loan row needs. Loan.toRoomId and LoanItem.fromRoomId have no Prisma relation,
// so the room names are loaded separately (roomNames below).
const LOAN_SELECT = {
  id: true,
  createdAt: true,
  dueAt: true,
  closedAt: true,
  status: true,
  reason: true,
  toRoomId: true,
  user: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      fromRoomId: true,
      returnedAt: true,
      item: { select: { code: true, name: true, category: { select: { name: true } } } },
    },
  },
};

// Room id → { id, name } for every room the given loans mention.
function roomNames(loans) {
  const ids = new Set();
  for (const loan of loans) {
    ids.add(loan.toRoomId);
    for (const loanItem of loan.items) {
      if (loanItem.fromRoomId) ids.add(loanItem.fromRoomId);
    }
  }
  return roomsById([...ids]);
}

// A loan is late when one of its items came back after the due time, is "Not yet returned"
// (OVERDUE), or is still out after the due time. The last case covers the few minutes before
// the MF-20 job marks the item OVERDUE.
export function isLate(loan, now = new Date()) {
  return loan.items.some(
    (loanItem) =>
      loanItem.status === 'OVERDUE' ||
      (loanItem.status === 'APPROVED' && loan.dueAt < now) ||
      (loanItem.status === 'RETURNED' && loanItem.returnedAt > loan.dueAt),
  );
}

// "Returned at" for a closed loan: when its last item came back. Open loans and loans
// where every item was declined have none.
function lastReturnedAt(loan) {
  if (loan.status !== 'CLOSED') return null;
  const times = loan.items.map((loanItem) => loanItem.returnedAt).filter(Boolean);
  return times.length ? new Date(Math.max(...times.map((time) => time.getTime()))) : null;
}

// One row of the Loans table (01 › Reports: loan date, borrower, items, from → to, reason,
// due, returned at, late). The borrower's email is included: /reports is moderators and
// admins only (requireRole in the route).
function loanRow(loan, rooms, now) {
  const fromIds = [...new Set(loan.items.map((loanItem) => loanItem.fromRoomId))].filter(Boolean);
  return {
    id: loan.id,
    createdAt: loan.createdAt,
    borrower: loan.user,
    items: loan.items.map((loanItem) => ({
      id: loanItem.id,
      code: loanItem.item.code,
      name: loanItem.item.name,
      category: loanItem.item.category.name,
      status: loanItem.status,
    })),
    fromRooms: fromIds.map((id) => rooms.get(id)).filter(Boolean),
    toRoom: rooms.get(loan.toRoomId) ?? null,
    reason: loan.reason,
    dueAt: loan.dueAt,
    status: loan.status,
    returnedAt: lastReturnedAt(loan),
    late: isLate(loan, now),
  };
}

// LoanItem statuses where the item really left its room. Waiting and declined items never moved.
const MOVED_STATUSES = ['APPROVED', 'OVERDUE', 'RETURNED'];

// How many entries "top categories" and "busiest rooms" show.
const TOP_COUNT = 3;

// Value → how many times it appears.
function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

// The TOP_COUNT biggest counts, biggest first; equal counts keep a fixed order (by key).
function top(counts) {
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, TOP_COUNT);
}

// The Loans summary (01 › Reports) over ALL loans that match the filters, not only one page:
// - itemsMoved: items that really left their room (approved, not yet returned or returned)
// - onTimePercent: returned items that came back by the due time, in whole percent; null when
//   nothing has been returned yet. Returned items without a return time are skipped.
// - topCategories: categories with the most moved items
// - busiestRooms: rooms with the most moves; each moved item counts once for the room it came
//   from and once for the room it went to
async function loansSummary(where) {
  const moved = await prisma.loanItem.findMany({
    where: { loan: where, status: { in: MOVED_STATUSES } },
    select: {
      returnedAt: true,
      fromRoomId: true,
      loan: { select: { dueAt: true, toRoomId: true } },
      item: { select: { category: { select: { name: true } } } },
    },
  });

  const returned = moved.filter((loanItem) => loanItem.returnedAt);
  const onTime = returned.filter((loanItem) => loanItem.returnedAt <= loanItem.loan.dueAt);

  const categories = top(countBy(moved.map((loanItem) => loanItem.item.category.name)));
  const roomCounts = top(
    countBy(
      moved.flatMap((loanItem) => [loanItem.fromRoomId, loanItem.loan.toRoomId]).filter(Boolean),
    ),
  );
  const rooms = await roomsById(roomCounts.map(([id]) => id));

  return {
    itemsMoved: moved.length,
    onTimePercent: returned.length ? Math.round((onTime.length / returned.length) * 100) : null,
    topCategories: categories.map(([name, count]) => ({ name, count })),
    busiestRooms: roomCounts.map(([id, count]) => ({
      id,
      name: rooms.get(id)?.name ?? null,
      count,
    })),
  };
}

// Loans that match the filters, newest first, as table rows.
async function findLoanRows(where, { skip, take }, now) {
  const loans = await prisma.loan.findMany({
    where,
    select: LOAN_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip,
    take,
  });
  const rooms = await roomNames(loans);
  return loans.map((loan) => loanRow(loan, rooms, now));
}

// GET /api/reports/loans → { data, total, summary } for one page, newest loan first.
// summary: { loans, itemsMoved, onTimePercent, topCategories, busiestRooms } for all matching
// loans. filters: { from, to, category, room, status, page, pageSize }, already validated.
export async function loansReport({ page, pageSize, ...filters }, now = new Date()) {
  const where = loansWhere(filters);
  const [total, data, summary] = await Promise.all([
    prisma.loan.count({ where }),
    findLoanRows(where, { skip: (page - 1) * pageSize, take: pageSize }, now),
    loansSummary(where),
  ]);
  return { data, total, summary: { loans: total, ...summary } };
}

// The CSV holds every matching loan, not only one page (same limit as the Inventory CSV).
export const LOANS_CSV_MAX_ROWS = 20000;

// Loan item statuses as on the badges (03 › Badge), for the Items cell.
const LOAN_ITEM_STATUS_LABELS = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  RETURNED: 'Returned',
  OVERDUE: 'Not yet returned',
};

// Date and time in the app's time zone, in a form Excel sorts correctly: "2026-11-24 13:00".
// Same format as the Not yet returned CSV (overdueService.js).
function localDateTime(value) {
  if (!value) return null;
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

// The Loans columns (01 › Reports: loan date, borrower, items, from → to, reason, due,
// returned at, late), plus the borrower's email and the loan status. Moderators and admins only.
const loansColumns = [
  { header: 'Loan date', value: (row) => localDateTime(row.createdAt) },
  { header: 'Borrower', value: (row) => row.borrower.name },
  { header: 'Email', value: (row) => row.borrower.email },
  {
    header: 'Items',
    value: (row) =>
      row.items
        .map((item) => `${item.name} ${item.code} (${LOAN_ITEM_STATUS_LABELS[item.status]})`)
        .join(', '),
  },
  { header: 'From', value: (row) => row.fromRooms.map((room) => room.name).join(', ') },
  { header: 'To', value: (row) => row.toRoom?.name },
  { header: 'Reason', value: (row) => row.reason },
  { header: 'Due', value: (row) => localDateTime(row.dueAt) },
  { header: 'Returned at', value: (row) => localDateTime(row.returnedAt) },
  { header: 'Late', value: (row) => (row.late ? 'Yes' : 'No') },
  { header: 'Status', value: (row) => (row.status === 'OPEN' ? 'Open' : 'Closed') },
];

// GET /api/reports/loans?format=csv → the CSV file as text, all matching loans, newest first.
// filters: as for loansReport, without the page.
export async function loansCsv(filters, now = new Date()) {
  const rows = await findLoanRows(loansWhere(filters), { take: LOANS_CSV_MAX_ROWS }, now);
  return toCsv(loansColumns, rows);
}

// ---------- Item history report (MF-32) ----------

// Prisma filter for the Item history tab (01 › Reports: one item or a date range).
// - code: one item's events (asset code, already upper-cased by the route)
// - from / to: the day the event happened, both days included, in TZ
function itemHistoryWhere({ code, from, to }) {
  const and = [];
  if (code) and.push({ item: { code } });
  if (from) and.push({ createdAt: { gte: startOfDay(from) } });
  if (to) and.push({ createdAt: { lt: startOfDay(nextDay(to)) } });
  return { AND: and };
}

// Item events that match `where`, newest first, in the same shape as the dashboard's
// Recent activity: { id, type, createdAt, user, item, loanId, fromRoom, toRoom, condition, note }.
// ItemEvent has no relations for the user and the rooms, so their names come from two extra
// queries. Also used by the item page timeline (M7 History).
export async function itemEvents(where, { skip, take }) {
  const events = await prisma.itemEvent.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip,
    take,
    select: {
      id: true,
      type: true,
      createdAt: true,
      userId: true,
      loanId: true,
      fromRoomId: true,
      toRoomId: true,
      note: true,
      item: { select: { code: true, name: true } },
    },
  });

  const [users, rooms] = await Promise.all([
    usersById(events.map((event) => event.userId)),
    roomsById(events.flatMap((event) => [event.fromRoomId, event.toRoomId])),
  ]);

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    createdAt: event.createdAt,
    user: users.get(event.userId) ?? null,
    item: event.item,
    loanId: event.loanId,
    fromRoom: rooms.get(event.fromRoomId) ?? null,
    toRoom: rooms.get(event.toRoomId) ?? null,
    ...splitNote(event),
  }));
}

// GET /api/reports/item-history → { data, total } for one page, newest event first.
// filters: { code, from, to, page, pageSize }, already validated by the route.
export async function itemHistoryReport({ page, pageSize, ...filters }) {
  const where = itemHistoryWhere(filters);
  const [total, data] = await Promise.all([
    prisma.itemEvent.count({ where }),
    itemEvents(where, { skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { data, total };
}

// GET /api/items/:code/history → { data, total } for one page of one item's events, newest
// first (M7 History card). An unknown code gives 404 ITEM_NOT_FOUND with the M8 wording, which
// is the wording of the staff screens.
export async function itemHistoryOf(code, { page, pageSize }) {
  const item = await prisma.item.findUnique({ where: { code }, select: { id: true } });
  if (!item) {
    throw new AppError(404, 'ITEM_NOT_FOUND', `No item with code ${code}`, { itemCode: code });
  }
  const where = { itemId: item.id };
  const [total, data] = await Promise.all([
    prisma.itemEvent.count({ where }),
    itemEvents(where, { skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { data, total };
}

// The CSV holds every matching event, not only one page (same limit as the other reports).
export const ITEM_HISTORY_CSV_MAX_ROWS = 20000;

// Event names for the CSV, in the words of the M7 History card.
const EVENT_LABELS = {
  CREATED: 'Created',
  EDITED: 'Edited',
  BORROWED: 'Borrowed',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  RETURNED: 'Returned (scanned)',
  MARKED_RETURNED: 'Marked returned',
  OVERDUE: 'Not yet returned',
  STATUS_CHANGED: 'Status changed',
  LOCATION_CORRECTED: 'Location corrected',
  HOME_CHANGED: 'Home room changed',
};

// A condition as the item's status badge shows it (02 › Item status shown in the app).
const CONDITION_LABELS = {
  GOOD: 'Available',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// "Status changed to Needs repair" when the new condition is known, else the event name.
function eventLabel(row) {
  const label = EVENT_LABELS[row.type] ?? row.type;
  return row.condition ? `${label} to ${CONDITION_LABELS[row.condition]}` : label;
}

// The Item history columns (01 › Reports: date, event, user, from → to room, note), with the
// item first, so a date-range file shows which item each event belongs to.
const itemHistoryColumns = [
  { header: 'Date', value: (row) => localDateTime(row.createdAt) },
  { header: 'Item', value: (row) => row.item.name },
  { header: 'Code', value: (row) => row.item.code },
  { header: 'Event', value: eventLabel },
  { header: 'User', value: (row) => row.user?.name },
  { header: 'From', value: (row) => row.fromRoom?.name },
  { header: 'To', value: (row) => row.toRoom?.name },
  { header: 'Note', value: (row) => row.note },
];

// GET /api/reports/item-history?format=csv → the CSV file as text, all matching events,
// newest first. filters: as for itemHistoryReport, without the page.
export async function itemHistoryCsv(filters) {
  const rows = await itemEvents(itemHistoryWhere(filters), { take: ITEM_HISTORY_CSV_MAX_ROWS });
  return toCsv(itemHistoryColumns, rows);
}
