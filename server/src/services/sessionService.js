// Login session: a signed JWT in the httpOnly cookie mf_session (02 › Auth).
// The token holds only the user id; role and "active" are loaded from the database
// on every request, so role changes and deactivation take effect immediately.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'mf_session';

const SESSION_HOURS = 8;
const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;
const ALGORITHM = 'HS256';

// "secure" only over https (Render, Metropolia). Locally http://localhost works without it.
const cookieOptions = {
  httpOnly: true,
  secure: new URL(env.BASE_URL).protocol === 'https:',
  sameSite: 'lax',
  path: '/',
};

export function startSession(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, env.SESSION_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: `${SESSION_HOURS}h`,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MS });
}

export function endSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

// Returns the user id from a valid session cookie, or null
// (no cookie, expired, wrong signature or changed by the client).
export function readSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return null;
  }
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET, { algorithms: [ALGORITHM] });
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
