// Lookup routes (02 › API contract).
// GET  /api/lookups                       user       all dropdown lists in one call
// GET  /api/lookups/suggest-code          moderator  short code suggestion
// POST /api/categories · /brands · /colours  moderator  "+ Add new"; returns the new entry
import { Router } from 'express';
import { z } from 'zod';
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

// TODO: add requireAuth from middleware/auth.js when MF-07 is merged.
lookupsRouter.get('/', async (req, res) => {
  res.json(await getLookups());
});

// TODO: add requireAuth + requireRole (moderator, admin) when MF-07 is merged.
lookupsRouter.get('/suggest-code', async (req, res) => {
  const { list, name } = suggestQuerySchema.parse(req.query);
  res.json({ code: await suggestCode(list, name) });
});

// ---------- "+ Add new" (mounted on /api) ----------

export const lookupEntriesRouter = Router();

// TODO: add requireAuth + requireRole (moderator, admin) to all three when MF-07 is merged.
lookupEntriesRouter.post('/categories', async (req, res) => {
  res.status(201).json(await createEntry('category', categorySchema.parse(req.body)));
});

lookupEntriesRouter.post('/brands', async (req, res) => {
  res.status(201).json(await createEntry('brand', entrySchema.parse(req.body)));
});

lookupEntriesRouter.post('/colours', async (req, res) => {
  res.status(201).json(await createEntry('colour', entrySchema.parse(req.body)));
});

lookupEntriesRouter.post('/campuses', async (req, res) => {
  res.status(201).json(await createEntry('campus', entrySchema.parse(req.body)));
});

lookupEntriesRouter.post('/buildings', async (req, res) => {
  res.status(201).json(await createBuilding(buildingSchema.parse(req.body)));
});

lookupEntriesRouter.post('/rooms', async (req, res) => {
  res.status(201).json(await createRoom(roomSchema.parse(req.body)));
});
