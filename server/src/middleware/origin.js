// CSRF protection: a POST, PUT, PATCH or DELETE is accepted only when it comes from our own app.
// The browser sends the Origin header (or at least Referer) with these requests,
// and another website cannot fake it. If it does not match BASE_URL, we answer 403.
import {env} from '../config/env.js';
import {AppError} from './error.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const allowedOrigin = new URL(env.BASE_URL).origin;

function originFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function originCheck(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get('origin') || originFromReferer(req.get('referer'));

  if (origin !== allowedOrigin) {
    return next(
      new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.')
    );
  }

  return next();
}
