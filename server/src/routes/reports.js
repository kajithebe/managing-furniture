// Report routes, mounted at /api/reports (02 › API contract). Moderators and admins only:
// requireRole('MODERATOR') also lets admins through. Students get 403, no session 401.
// GET /api/reports/inventory              M9 Inventory tab → { data, total } for one page
// GET /api/reports/inventory?format=csv   the same filters → all matching items as a CSV file
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { SHOWN_STATUSES, SORT_COLUMNS } from '../services/itemService.js';
import { inventoryCsv, inventoryReport } from '../services/reportService.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole('MODERATOR'));

// Query string values are text, so ids are converted to numbers.
const queryId = z.coerce.number().int().positive().optional();

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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  format: z.enum(['csv']).optional(),
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
