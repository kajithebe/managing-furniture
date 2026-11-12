// Builds the Express app. server.js starts it; tests can import it without starting a server.
import express from 'express';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();

  // Routes are added here in the next steps.

  // These two must stay last: first "nothing matched", then the error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}