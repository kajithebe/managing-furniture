// General rate limit on /api (02 › Security): 300 requests per 15 minutes per IP.
// The login code limit (3 per email per 15 min) is in authService.
import { rateLimit } from 'express-rate-limit';
import { AppError } from './error.js';

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  // Send the standard RateLimit headers, not the old X-RateLimit-* ones.
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Docker and Render call /api/health every few seconds: never block that.
  skip: (req) => req.path === '/health',
  // Same error shape as every other error in the API.
  handler: (req, res, next) => {
    next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Please try again later.'));
  },
});
