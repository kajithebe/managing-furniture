// Builds the Express app. server.js starts it; tests can import it without starting a server.
import express from 'express';
import helmet from 'helmet';
import {errorHandler, notFound} from './middleware/error.js';
import {originCheck} from './middleware/origin.js';
import {healthRouter} from './routes/health.js';

export function createApp() {
  const app = express();

  // Do not tell clients which framework we use.
  app.disable('x-powered-by');

  // Security headers: helmet's default Content Security Policy,
  // plus data: images, because QR codes are shown as data: images.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:'],
        },
      },
    })
  );

  // Reject cross-site POST/PUT/PATCH/DELETE before reading the body.
  app.use(originCheck);

  // Parse JSON request bodies, max 100 kB.
  app.use(express.json({limit: '100kb'}));

  // API routes (base path /api, see the API contract)
  app.use('/api/health', healthRouter);

  // These two must stay last: first "nothing matched", then the error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
