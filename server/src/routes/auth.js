// Login routes, mounted at /api/auth. Routes stay thin: validate, call the service, respond.
import { Router } from 'express';
import { z } from 'zod';
import { requestCode } from '../services/authService.js';

export const authRouter = Router();

// Trimmed and lower-cased before the check (02 › Login security). Unknown fields are stripped.
const email = z.string().trim().toLowerCase().pipe(z.email());

const requestCodeBody = z.object({ email });

// POST /api/auth/request-code – public, same reply whether the email has an account or not.
authRouter.post('/request-code', async (req, res) => {
  const body = requestCodeBody.parse(req.body);
  res.json(await requestCode(body.email));
});
