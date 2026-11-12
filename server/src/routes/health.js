// GET /api/health – public. Used by Docker and Render to check that the app is running.
import {Router} from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  // Never cache: a health check must always reach the running server.
  res.set('Cache-Control', 'no-store');
  res.json({ok: true});
});
