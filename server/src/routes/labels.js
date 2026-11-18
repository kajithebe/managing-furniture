// Label routes (02 › API contract), mounted at /api/labels. Moderators and admins only.
// GET /api/labels/items?codes=MP-00123,MP-00124  → { data: [{ code, name, homeRoom, qrImage }] }
// GET /api/labels/rooms?ids=1,2                  → { data: [{ id, name, building, campus, qrImage }] }
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { itemLabels, roomLabels } from '../services/labelService.js';

export const labelsRouter = Router();

labelsRouter.use(requireAuth, requireRole('MODERATOR'));

// Same limit as bulk add: at most 200 labels in one go.
const MAX_LABELS = 200;

// "a,b,,c" → ["a", "b", "c"]; the same entry twice gives one label.
const commaList = (value) => [
  ...new Set(
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  ),
];

const itemsQuery = z.object({
  codes: z
    .string()
    .max(10000)
    .transform((value) => commaList(value.toUpperCase()))
    .pipe(z.array(z.string().max(30)).min(1).max(MAX_LABELS)),
});

const roomsQuery = z.object({
  ids: z
    .string()
    .max(10000)
    .transform(commaList)
    .pipe(z.array(z.coerce.number().int().positive()).min(1).max(MAX_LABELS))
    // "3,03" are the same room after the numbers are read.
    .transform((ids) => [...new Set(ids)]),
});

labelsRouter.get('/items', async (req, res) => {
  const { codes } = itemsQuery.parse(req.query);
  res.json(await itemLabels(codes));
});

labelsRouter.get('/rooms', async (req, res) => {
  const { ids } = roomsQuery.parse(req.query);
  res.json(await roomLabels(ids));
});
