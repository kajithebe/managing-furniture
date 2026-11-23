// Builds the Express app. server.js starts it; tests can import it without starting a server.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/error.js';
import { originCheck } from './middleware/origin.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { itemsRouter } from './routes/items.js';
import { labelsRouter } from './routes/labels.js';
import { loansRouter } from './routes/loans.js';
import { lookupEntriesRouter, lookupsRouter } from './routes/lookups.js';
import { moderatorRouter } from './routes/moderator.js';
import { reportsRouter } from './routes/reports.js';

// The built React app (npm run build in client/). In production Express serves it, so the API
// and the screens come from one origin (02 › Security: no CORS).
const DEFAULT_CLIENT_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist',
);

export function createApp({ clientDist = DEFAULT_CLIENT_DIST } = {}) {
  const app = express();

  // Do not tell clients which framework we use.
  app.disable('x-powered-by');

  // On Render (and at Metropolia) one proxy sits in front of the app and adds HTTPS. Trusting it
  // gives the real client IP to the rate limit and lets secure cookies work (02 › Deployment).
  app.set('trust proxy', 1);

  // Security headers: helmet's default Content Security Policy,
  // plus data: images, because QR codes are shown as data: images.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:'],
        },
      },
    }),
  );

  // Max 300 API requests per 15 minutes per IP, checked before any other work.
  app.use('/api', apiRateLimit);

  // Reject cross-site POST/PUT/PATCH/DELETE before reading the body.
  app.use(originCheck);

  // Parse JSON request bodies, max 100 kB.
  app.use(express.json({ limit: '100kb' }));

  // Read cookies into req.cookies (the session cookie is a signed JWT, see sessionService).
  app.use(cookieParser());

  // API routes (base path /api, see the API contract)
  app.use('/api/health', healthRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/labels', labelsRouter);
  app.use('/api/loans', loansRouter);
  app.use('/api/lookups', lookupsRouter);
  app.use('/api/moderator', moderatorRouter);
  app.use('/api', lookupEntriesRouter);
  app.use('/api/reports', reportsRouter);

  // An unknown /api path is a JSON 404, never the React page.
  app.use('/api', notFound);

  // The screens: built files from client/dist, and index.html for every other GET, so React
  // Router can open /loans, /i/MP-00123 … directly. Only when the client has been built.
  if (existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // These two must stay last: first "nothing matched", then the error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
