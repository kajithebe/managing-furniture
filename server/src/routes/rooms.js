// Room routes, mounted at /api/rooms (02 › API contract).
// GET /api/rooms/by-qr/:qrToken   user   room from a door QR (S8, S12)
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { roomByQrToken } from '../services/roomService.js';

export const roomsRouter = Router();

// Door QR tokens are base64url text (crypto.randomBytes(12), 16 characters).
const qrParams = z.object({
  qrToken: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

roomsRouter.get('/by-qr/:qrToken', requireAuth, async (req, res) => {
  const { qrToken } = qrParams.parse(req.params);
  res.json(await roomByQrToken(qrToken));
});
