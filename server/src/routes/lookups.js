// Lookup routes (02 › API contract).
// GET /api/lookups – user: all dropdown lists in one call.
import { Router } from 'express';
import { getLookups } from '../services/lookupService.js';

export const lookupsRouter = Router();

// TODO: add requireAuth from middleware/auth.js when MF-07 is merged.
lookupsRouter.get('/', async (req, res) => {
  res.json(await getLookups());
});
