// Admin routes, mounted at /api/admin. Admins only: moderators and students get 403,
// users without a session 401 (02 › Security › Access control).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { USER_SORT_COLUMNS, listUsers } from '../services/userService.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

// A2 filters: "Name or email", Role (All / User / Moderator / Admin),
// Status (All / Active / Deactivated), the sort arrows and paging (25 per page).
// z.object drops unknown fields.
const usersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DEACTIVATED']).optional(),
  sort: z.enum(USER_SORT_COLUMNS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// GET /api/admin/users → { data, total, activeAdmins }
adminRouter.get('/users', async (req, res) => {
  res.json(await listUsers(usersQuery.parse(req.query)));
});
