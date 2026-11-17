// Moderator routes, mounted at /api/moderator. Moderators and admins only: requireRole('MODERATOR')
// also lets admins through. Students get 403, users without a session 401.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { decideLoanItem, listWaitingRequests } from '../services/approvalService.js';

export const moderatorRouter = Router();

moderatorRouter.use(requireAuth, requireRole('MODERATOR'));

// GET /api/moderator/requests – M2 Waiting tab.
moderatorRouter.get('/requests', async (req, res) => {
  res.json(await listWaitingRequests());
});

const loanItemParams = z.object({ id: z.coerce.number().int().positive() });

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
    const { id } = loanItemParams.parse(req.params);
    const { note } = decisionBody.parse(req.body ?? {});
    res.json(await decideLoanItem(id, req.user, { approve, note }));
  });
}
