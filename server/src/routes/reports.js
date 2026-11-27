// Report routes, mounted at /api/reports (02 › API contract). Moderators and admins only:
// requireRole('MODERATOR') also lets admins through. Students get 403, no session 401.
// GET /api/reports/inventory              M9 Inventory tab → { data, total } for one page
// GET /api/reports/inventory?format=csv   the same filters → all matching items as a CSV file
// GET /api/reports/overdue                M9 Not yet returned tab → { data, total, notYetReturned }
// GET /api/reports/overdue?format=csv     the same filters → all matching rows as a CSV file
// GET /api/reports/loans                  M9 Loans tab → { data, total, summary } for one page
// GET /api/reports/loans?format=csv       the same filters → all matching loans as a CSV file
// GET /api/reports/item-history           M9 Item history tab → { data, total } for one page
// GET /api/reports/item-history?format=csv  the same filters → all matching events as a CSV file
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { SHOWN_STATUSES, SORT_COLUMNS } from '../services/itemService.js';
import { OVERDUE_SORT_COLUMNS, listOverdue, overdueCsv } from '../services/overdueService.js';
import {
  inventoryCsv,
  inventoryReport,
  itemHistoryCsv,
  itemHistoryReport,
  loansCsv,
  loansReport,
} from '../services/reportService.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole('MODERATOR'));

// Query string values are text, so ids are converted to numbers.
const queryId = z.coerce.number().int().positive().optional();

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);

// A real calendar day as YYYY-MM-DD. The round trip refuses days like 2026-02-31.
function isCalendarDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}
const dateText = z.string().refine(isCalendarDate, 'Use a date like 2026-11-20').optional();

// The M9 filters (Campus, Building, Room, Category, Status), the sort arrows and paging.
// z.object drops unknown fields, so e.g. showDisposed or q cannot be sent to this report.
const inventoryQuery = z.object({
  campus: queryId,
  building: queryId,
  room: queryId,
  category: queryId,
  status: z.enum(SHOWN_STATUSES).optional(),
  sort: z.enum(SORT_COLUMNS).default('code'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page,
  pageSize,
  format: z.enum(['csv']).optional(),
});

// The Loans filters (01 › Reports): date range, category, room, status.
const loansQuery = z
  .object({
    from: dateText,
    to: dateText,
    category: queryId,
    room: queryId,
    status: z.enum(['OPEN', 'CLOSED']).optional(),
    page,
    pageSize,
    format: z.enum(['csv']).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'The start date must be on or before the end date',
    path: ['from'],
  });

// The Item history filters (01 › Reports): one item (asset code) or a date range, or both.
// Codes are upper-cased like everywhere else, and are at most 30 characters (02 › Asset codes).
const itemHistoryQuery = z
  .object({
    code: z.string().trim().toUpperCase().min(1).max(30).optional(),
    from: dateText,
    to: dateText,
    page,
    pageSize,
    format: z.enum(['csv']).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'The start date must be on or before the end date',
    path: ['from'],
  });

// Today's date in the app's time zone, for the file name: "inventory-2026-11-18.csv".
function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: env.TZ });
}

reportsRouter.get('/inventory', async (req, res) => {
  const { format, ...filters } = inventoryQuery.parse(req.query);

  if (format === 'csv') {
    const csv = await inventoryCsv(filters);
    res.attachment(`inventory-${today()}.csv`);
    res.type('text/csv; charset=utf-8');
    res.send(csv);
    return;
  }

  res.json(await inventoryReport(filters));
});

// The M9 Not yet returned filters (Category, Room), sort arrows and paging: the same as the
// M4 list (GET /api/moderator/overdue), so both show the same rows.
const overdueQuery = z.object({
  category: queryId,
  room: queryId,
  sort: z.enum(OVERDUE_SORT_COLUMNS).default('lateBy'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  format: z.enum(['csv']).optional(),
});

reportsRouter.get('/overdue', async (req, res) => {
  const { format, ...filters } = overdueQuery.parse(req.query);

  if (format === 'csv') {
    const csv = await overdueCsv(filters);
    res.attachment(`not-yet-returned-${today()}.csv`);
    res.type('text/csv; charset=utf-8');
    res.send(csv);
    return;
  }

  res.json(await listOverdue(filters));
});

reportsRouter.get('/loans', async (req, res) => {
  const { format, page, pageSize, ...filters } = loansQuery.parse(req.query);

  if (format === 'csv') {
    const csv = await loansCsv(filters);
    res.attachment(`loans-${today()}.csv`);
    res.type('text/csv; charset=utf-8');
    res.send(csv);
    return;
  }

  res.json(await loansReport({ ...filters, page, pageSize }));
});

reportsRouter.get('/item-history', async (req, res) => {
  const { format, page, pageSize, ...filters } = itemHistoryQuery.parse(req.query);

  if (format === 'csv') {
    const csv = await itemHistoryCsv(filters);
    res.attachment(`item-history-${today()}.csv`);
    res.type('text/csv; charset=utf-8');
    res.send(csv);
    return;
  }

  res.json(await itemHistoryReport({ ...filters, page, pageSize }));
});
