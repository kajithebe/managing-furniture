// Borrow request routes, mounted at /api/loans. Routes stay thin: validate, call the service,
// respond. The borrower is always the logged-in user, never an id from the request.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createLoan, listMyLoans } from '../services/loanService.js';
import { returnItems } from '../services/returnService.js';

export const loansRouter = Router();

const itemCode = z.string().trim().toUpperCase().min(1).max(30);

// S4: items, "Move to room", "Until" and "Why?" (max 120 characters).
const createLoanBody = z.object({
  itemCodes: z
    .array(itemCode)
    .min(1)
    .max(50)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Each item can be in the request only once.',
    }),
  toRoomId: z.number().int().positive(),
  dueAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  reason: z.string().trim().min(1).max(120),
});

// POST /api/loans – user. Creates a borrow request; the reply is what S6 shows.
loansRouter.post('/', requireAuth, async (req, res) => {
  const body = createLoanBody.parse(req.body);
  res.status(201).json(await createLoan(req.user.id, body));
});

// GET /api/loans/mine – user. S7 My loans: { open: [...], recent: [...] }.
loansRouter.get('/mine', requireAuth, async (req, res) => {
  res.json(await listMyLoans(req.user.id));
});

const loanParams = z.object({ id: z.coerce.number().int().positive() });

// S8 + S9: the door QR of the home room and the scanned item codes (one or more).
const returnBody = z.object({
  roomQrToken: z.string().trim().min(1).max(64),
  itemCodes: z
    .array(itemCode)
    .min(1)
    .max(50)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Each item can be returned only once per call.',
    }),
});

// POST /api/loans/:id/return – user. Returns the items; the reply is the loan (S9, S10).
loansRouter.post('/:id/return', requireAuth, async (req, res) => {
  const { id } = loanParams.parse(req.params);
  const body = returnBody.parse(req.body);
  res.json(await returnItems(req.user.id, id, body));
});
