// Item routes (02 › API contract).
// GET  /api/items/next-code   moderator  preview of the next asset code
// POST /api/items             moderator  create 1–200 items; returns an array of created items
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { previewNextCode } from '../services/codeService.js';
import { createItems } from '../services/itemService.js';

// ---------- Validation ----------

const id = z.number().int().positive();
const optionalId = id.nullish();

// Query string values are text, so they are converted to numbers.
// Sprint 1 ignores them; the code scheme (MF-21) uses them for campus, category … segments.
const queryId = z.coerce.number().int().positive().optional();
const nextCodeQuerySchema = z.object({
  categoryId: queryId,
  homeRoomId: queryId,
  brandId: queryId,
  colourId: queryId,
});

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

// ---------- Routes ----------

export const itemsRouter = Router();

// TODO: add requireAuth + requireRole('MODERATOR') to both routes when MF-07 is merged.
itemsRouter.get('/next-code', async (req, res) => {
  nextCodeQuerySchema.parse(req.query);
  res.json({ code: await previewNextCode(prisma) });
});

itemsRouter.post('/', async (req, res) => {
  const data = createItemSchema.parse(req.body);
  // TODO: pass req.user.id when MF-07 is merged.
  res.status(201).json(await createItems(data, null));
});
