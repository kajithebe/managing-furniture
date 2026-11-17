// Moderator routes, mounted at /api/moderator. Moderators and admins only: requireRole('MODERATOR')
// also lets admins through. Students get 403, users without a session 401.
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listWaitingRequests } from '../services/approvalService.js';

export const moderatorRouter = Router();

moderatorRouter.use(requireAuth, requireRole('MODERATOR'));

// GET /api/moderator/requests – M2 Waiting tab.
moderatorRouter.get('/requests', async (req, res) => {
  res.json(await listWaitingRequests());
});
