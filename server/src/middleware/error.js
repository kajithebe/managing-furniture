// Central error handling: every error becomes the response shape from the API contract,
// { "error": { "code": "...", "message": "..." } }, with the right HTTP status.
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';

// Throw this from routes and services for expected errors, for example:
// throw new AppError(400, 'LOAN_TOO_LONG', 'Until time is longer than 4 hours.');
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

// Any request that no route answered.
export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Not found.'));
}

// Express knows this is an error handler because it has four parameters,
// so `next` must stay even though it is only used when the response has already started.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong.';

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = err.issues
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .join('; ');
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON.';
  }

  if (status >= 500) {
    // Log only the method, path and stack trace: never the request body, cookies or tokens.
    console.error(`${req.method} ${req.originalUrl} failed:`, err.stack || err);
  }

  const body = { error: { code, message } };
  // Stack traces help while developing, but are never sent in production.
  if (status >= 500 && !isProduction) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}