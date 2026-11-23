// Admin routes, mounted at /api/admin. Admins only: moderators and students get 403,
// users without a session 401 (02 › Security › Access control).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { USER_SORT_COLUMNS, createUser, listUsers, updateUser } from '../services/userService.js';

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

// P14 Add user: Email *, Name, Role (User by default). z.object drops unknown fields,
// so a client cannot set active, lastLoginAt …
const createUserBody = z.object({
  email: z.string().trim().toLowerCase().min(1).max(254),
  name: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN']).default('USER'),
});

// POST /api/admin/users → 201 with the new row (same shape as the list)
adminRouter.post('/users', async (req, res) => {
  const body = createUserBody.parse(req.body ?? {});
  res.status(201).json(await createUser(req.user.id, body));
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

// A2 panel: Role (P15 Change role) and Status (P16 Deactivate, Reactivate).
// At least one of them; unknown fields are dropped, so name and email cannot be changed here.
const updateUserBody = z
  .object({
    role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => body.role !== undefined || body.active !== undefined, {
    message: 'Send role or active',
  });

// PATCH /api/admin/users/:id → the updated row (same shape as the list)
adminRouter.patch('/users/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  const changes = updateUserBody.parse(req.body ?? {});
  res.json(await updateUser(req.user.id, id, changes));
});
