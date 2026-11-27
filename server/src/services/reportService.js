// Reports (01 › Reports, M9 in design-screens). Each report is a filtered table with a
// Download CSV button. Sprint 1 has the Inventory report; Sprint 2 adds Loans and Item history.
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { toCsv } from '../utils/csv.js';
import { startOfToday } from './approvalService.js';
import { listItems } from './itemService.js';

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

// Room id → { id, name } for every room the loans on this page mention, in one query.
async function roomNames(loans) {
  const ids = new Set();
  for (const loan of loans) {
    ids.add(loan.toRoomId);
    for (const loanItem of loan.items) {
      if (loanItem.fromRoomId) ids.add(loanItem.fromRoomId);
    }
  }
  const rooms = await prisma.room.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true },
  });
  return new Map(rooms.map((room) => [room.id, room]));
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

// GET /api/reports/loans → { data, total } for one page, newest loan first.
// filters: { from, to, category, room, status, page, pageSize }, already validated by the route.
export async function loansReport({ page, pageSize, ...filters }, now = new Date()) {
  const where = loansWhere(filters);
  const [total, loans] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      select: LOAN_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const rooms = await roomNames(loans);
  return { data: loans.map((loan) => loanRow(loan, rooms, now)), total };
}
