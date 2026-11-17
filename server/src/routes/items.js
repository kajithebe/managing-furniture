// Item routes (02 › API contract).
// GET  /api/items/next-code   moderator  first and last code of the next `quantity` items
// GET  /api/items             moderator  list with filters, search and paging → { data, total }
// GET  /api/items/:code       user       one item with rooms, category rule and shown status
// POST /api/items             moderator  create 1–200 items; returns an array of created items
// PATCH /api/items/:code      moderator  edit details (code read-only); returns the item
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { previewCodes } from '../services/codeService.js';
import {
  createItems,
  getItem,
  listItems,
  SHOWN_STATUSES,
  updateItem,
} from '../services/itemService.js';

// ---------- Validation ----------

const id = z.number().int().positive();
const optionalId = id.nullish();

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
  room: queryId,
  status: z.enum(SHOWN_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
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
    condition: z.enum(['GOOD', 'NEEDS_REPAIR', 'BROKEN', 'IN_REPAIR', 'DISPOSED']).default('GOOD'),
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

// Only the details below can be edited; code, condition, rooms and onLoan are dropped.
// The wheels rule is checked in the service, together with the item's current values.
const updateItemSchema = z
  .object({
    categoryId: id.optional(),
    name: z.string().trim().max(100).optional(),
    brandId: optionalId,
    colourId: optionalId,
    hasWheels: z.boolean().optional(),
    wheelCount: z.number().int().min(1).max(12).nullish(),
    notes: z.string().trim().max(1000).nullish(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to change.');

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
  res.json(await getItem(code));
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
