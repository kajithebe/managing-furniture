// Item routes (02 › API contract).
// GET  /api/items/next-code   moderator  first and last code of the next `quantity` items
// GET  /api/items             moderator  M5 list: filters, search, sorting, paging → { data, total }
// GET  /api/items/:code       user       one item with rooms, category rule and shown status
// POST /api/items             moderator  create 1–200 items; returns an array of created items
// PATCH /api/items/:code      moderator  edit details and rooms (code read-only); returns the item
// PATCH /api/items/:code/status  moderator  change condition with a reason (MF-29); returns the item
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { previewCodes } from '../services/codeService.js';
import {
  changeCondition,
  createItems,
  getItem,
  listItems,
  SHOWN_STATUSES,
  SORT_COLUMNS,
  updateItem,
} from '../services/itemService.js';

// ---------- Validation ----------

const id = z.number().int().positive();
const optionalId = id.nullish();

// The stored conditions (02 › Item status). "Available" in the app is GOOD.
const CONDITIONS = ['GOOD', 'NEEDS_REPAIR', 'BROKEN', 'IN_REPAIR', 'DISPOSED'];
// Why a moderator changed something: same limits as the Edit form's reason.
const reason = z.string().trim().min(1).max(500);

// Query string values are text, so they are converted to numbers.
// Sprint 1 ignores them; the code scheme (MF-21) uses them for campus, category … segments.
const queryId = z.coerce.number().int().positive().optional();
const nextCodeQuerySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(200).default(1),
  categoryId: queryId,
  homeRoomId: queryId,
  brandId: queryId,
  colourId: queryId,
});

const listQuerySchema = z.object({
  category: queryId,
  campus: queryId,
  building: queryId,
  room: queryId,
  status: z.enum(SHOWN_STATUSES).optional(),
  // "true" / "false" from the "Show disposed items" toggle.
  showDisposed: z.stringbool().default(false),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(SORT_COLUMNS).default('code'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// Codes are stored in upper case; a typed code may be lower case.
const codeParamSchema = z.object({ code: z.string().trim().toUpperCase().min(1).max(30) });

// z.object drops unknown fields, so a client cannot set code, onLoan, createdById …
const createItemSchema = z
  .object({
    categoryId: id,
    name: z.string().trim().max(100).optional(),
    brandId: optionalId,
    colourId: optionalId,
    hasWheels: z.boolean().default(false),
    wheelCount: z.number().int().min(1).max(12).nullish(),
    homeRoomId: id,
    currentRoomId: optionalId,
    // "On loan" is never set here: only the loan and return services change onLoan.
    condition: z.enum(CONDITIONS).default('GOOD'),
    quantity: z.number().int().min(1).max(200).default(1),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((item, ctx) => {
    // Wheels rule: number of wheels is required (1–12) when the item has wheels.
    if (item.hasWheels && !item.wheelCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['wheelCount'],
        message: 'is required (1–12) when the item has wheels',
      });
    }
  });

// Only the details and rooms below can be edited (M6 Edit item, 02 › Edit item, 24 Nov 2026);
// code, condition and onLoan are dropped. The wheels rule and the room rules are checked in
// the service, together with the item's current values.
const updateItemSchema = z
  .object({
    categoryId: id.optional(),
    name: z.string().trim().max(100).optional(),
    brandId: optionalId,
    colourId: optionalId,
    hasWheels: z.boolean().optional(),
    wheelCount: z.number().int().min(1).max(12).nullish(),
    notes: z.string().trim().max(1000).nullish(),
    homeRoomId: id.optional(),
    currentRoomId: id.optional(),
    // Why a room changed (02 › Edit item, decided 25 Nov 2026). Required by the service when
    // homeRoomId or currentRoomId really changes, because only then is it known.
    reason: reason.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to change.');

// M7 "Change status" (MF-29). onLoan is never set here.
const statusChangeSchema = z.object({ condition: z.enum(CONDITIONS), reason });

// ---------- Routes ----------

export const itemsRouter = Router();

// Moderators and admins only (requireRole('MODERATOR') also lets admins through).
const moderator = [requireAuth, requireRole('MODERATOR')];

itemsRouter.get('/', moderator, async (req, res) => {
  res.json(await listItems(listQuerySchema.parse(req.query)));
});

// Must stay above /:code, otherwise "next-code" would be read as an item code.
itemsRouter.get('/next-code', moderator, async (req, res) => {
  const { quantity } = nextCodeQuerySchema.parse(req.query);
  res.json(await previewCodes(prisma, quantity));
});

// Every logged-in user: this is the page a QR scan opens.
itemsRouter.get('/:code', requireAuth, async (req, res) => {
  const { code } = codeParamSchema.parse(req.params);
  res.json(await getItem(code, req.user));
});

itemsRouter.post('/', moderator, async (req, res) => {
  const data = createItemSchema.parse(req.body);
  res.status(201).json(await createItems(data, req.user.id));
});

itemsRouter.patch('/:code', moderator, async (req, res) => {
  const { code } = codeParamSchema.parse(req.params);
  const changes = updateItemSchema.parse(req.body);
  res.json(await updateItem(code, changes, req.user.id));
});

itemsRouter.patch('/:code/status', moderator, async (req, res) => {
  const { code } = codeParamSchema.parse(req.params);
  const change = statusChangeSchema.parse(req.body);
  res.json(await changeCondition(code, change, req.user));
});
