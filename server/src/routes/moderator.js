// Moderator routes, mounted at /api/moderator. Moderators and admins only: requireRole('MODERATOR')
// also lets admins through. Students get 403, users without a session 401.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  decideLoanItem,
  getLoanDetail,
  listDecidedToday,
  listWaitingRequests,
} from '../services/approvalService.js';
import { getDashboard } from '../services/dashboardService.js';
import { OVERDUE_SORT_COLUMNS, listOverdue } from '../services/overdueService.js';
import { markReturned } from '../services/returnService.js';

export const moderatorRouter = Router();

moderatorRouter.use(requireAuth, requireRole('MODERATOR'));

// M2 has two tabs: Waiting (default) and Decided today (with paging).
const requestsQuery = z.object({
  tab: z.enum(['waiting', 'decided']).default('waiting'),
  page: z.coerce.number().int().min(1).default(1),
});

// GET /api/moderator/requests?tab=waiting|decided&page= – M2.
moderatorRouter.get('/requests', async (req, res) => {
  const { tab, page } = requestsQuery.parse(req.query);
  res.json(tab === 'decided' ? await listDecidedToday({ page }) : await listWaitingRequests());
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

// GET /api/moderator/loans/:id – M3 Loan detail.
moderatorRouter.get('/loans/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await getLoanDetail(id));
});

// P10: "Note to the borrower" is optional. An empty note is saved as no note.
const decisionBody = z.object({
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

// POST /api/moderator/loan-items/:id/approve and /decline – one item at a time (M2, P10).
for (const [action, approve] of [
  ['approve', true],
  ['decline', false],
]) {
  moderatorRouter.post(`/loan-items/:id/${action}`, async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { note } = decisionBody.parse(req.body ?? {});
    res.json(await decideLoanItem(id, req.user, { approve, note }));
  });
}

// POST /api/moderator/loan-items/:id/mark-returned – P12 (M4, M7). The P12 "Note" is optional,
// with the same rules as the P10 note: max 500 characters, empty = no note.
moderatorRouter.post('/loan-items/:id/mark-returned', async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { note } = decisionBody.parse(req.body ?? {});
  res.json(await markReturned(id, req.user, { note }));
});

// GET /api/moderator/dashboard – M1: tiles, lists, items by status, recent activity in one call.
moderatorRouter.get('/dashboard', async (req, res) => {
  res.json(await getDashboard());
});

// Query string values are text, so ids are converted to numbers.
const queryId = z.coerce.number().int().positive().optional();

// M4 filters (Category, Room), sort arrows and paging. The item that is late the longest
// comes first by default. z.object drops unknown fields.
const overdueQuery = z.object({
  category: queryId,
  room: queryId,
  sort: z.enum(OVERDUE_SORT_COLUMNS).default('lateBy'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// GET /api/moderator/overdue – M4 Not yet returned → { data, total, notYetReturned }.
moderatorRouter.get('/overdue', async (req, res) => {
  res.json(await listOverdue(overdueQuery.parse(req.query)));
});
