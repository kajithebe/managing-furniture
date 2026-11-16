// Lookup routes (02 › API contract).
// GET  /api/lookups                       user       all dropdown lists in one call
// GET  /api/lookups/suggest-code          moderator  short code suggestion
// POST /api/categories · /brands · /colours · /campuses · /buildings · /rooms
//                                         moderator  "+ Add new"; returns the new entry
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getLookups } from '../services/lookupService.js';
import { createEntry, LIST_NAMES, suggestCode } from '../services/listService.js';
import { createBuilding, createRoom } from '../services/locationService.js';
import { SHORT_CODE_PATTERN } from '../services/shortCodeService.js';

// ---------- Validation ----------

const nameSchema = z.string().trim().min(1, 'is required').max(60);

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SHORT_CODE_PATTERN, 'must be 2–5 letters (A–Z) or digits');

// z.object drops unknown fields, so a client cannot set id, archived …
const entrySchema = z.object({ name: nameSchema, code: codeSchema.optional() });
const categorySchema = entrySchema.extend({ autoApprove: z.boolean().default(false) });
const buildingSchema = z.object({ campusId: z.number().int().positive(), name: nameSchema });
const roomSchema = z.object({ buildingId: z.number().int().positive(), name: nameSchema });
const suggestQuerySchema = z.object({ list: z.enum(LIST_NAMES), name: nameSchema });

// ---------- /api/lookups ----------

export const lookupsRouter = Router();

// Every logged-in user: the item page and the borrow form need the room lists.
lookupsRouter.get('/', requireAuth, async (req, res) => {
  res.json(await getLookups());
});

lookupsRouter.get('/suggest-code', requireAuth, requireRole('MODERATOR'), async (req, res) => {
  const { list, name } = suggestQuerySchema.parse(req.query);
  res.json({ code: await suggestCode(list, name) });
});

// ---------- "+ Add new" (mounted on /api) ----------

export const lookupEntriesRouter = Router();

// Moderators and admins only (requireRole('MODERATOR') also lets admins through).
const moderator = [requireAuth, requireRole('MODERATOR')];

lookupEntriesRouter.post('/categories', moderator, async (req, res) => {
  res.status(201).json(await createEntry('category', categorySchema.parse(req.body)));
});

lookupEntriesRouter.post('/brands', moderator, async (req, res) => {
  res.status(201).json(await createEntry('brand', entrySchema.parse(req.body)));
});

lookupEntriesRouter.post('/colours', moderator, async (req, res) => {
  res.status(201).json(await createEntry('colour', entrySchema.parse(req.body)));
});

lookupEntriesRouter.post('/campuses', moderator, async (req, res) => {
  res.status(201).json(await createEntry('campus', entrySchema.parse(req.body)));
});

lookupEntriesRouter.post('/buildings', moderator, async (req, res) => {
  res.status(201).json(await createBuilding(buildingSchema.parse(req.body)));
});

lookupEntriesRouter.post('/rooms', moderator, async (req, res) => {
  res.status(201).json(await createRoom(roomSchema.parse(req.body)));
});
