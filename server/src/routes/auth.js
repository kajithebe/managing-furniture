// Login routes, mounted at /api/auth. Routes stay thin: validate, call the service, respond.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, requestCode, verifyCode } from '../services/authService.js';
import { endSession, startSession } from '../services/sessionService.js';
import { updateOwnName } from '../services/userService.js';

export const authRouter = Router();

// Trimmed and lower-cased before the check (02 › Login security). Unknown fields are stripped.
const email = z.string().trim().toLowerCase().pipe(z.email());

// "482 913" and "482913" are both accepted: spaces are removed first.
const code = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'must be 6 digits'));

const requestCodeBody = z.object({ email });
const verifyCodeBody = z.object({ email, code });
const updateMeBody = z.object({ name: z.string().trim().min(1).max(100) });

// POST /api/auth/request-code – public, same reply whether the email has an account or not.
authRouter.post('/request-code', async (req, res) => {
  const body = requestCodeBody.parse(req.body);
  res.json(await requestCode(body.email));
});

// POST /api/auth/verify-code – public. A correct code starts the session (mf_session cookie).
authRouter.post('/verify-code', async (req, res) => {
  const body = verifyCodeBody.parse(req.body);
  const user = await verifyCode(body.email, body.code);
  startSession(res, user.id);
  res.json(user);
});

// POST /api/auth/logout – user. Deletes the session cookie in the browser.
authRouter.post('/logout', requireAuth, (req, res) => {
  endSession(res);
  res.json({ ok: true });
});

// GET /api/auth/me – user. The logged-in user (requireAuth loaded it from the database).
authRouter.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

// PATCH /api/auth/me – user. Change the own name (taken from the email on first login).
authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = updateMeBody.parse(req.body);
  res.json(await updateOwnName(req.user.id, body.name));
});
