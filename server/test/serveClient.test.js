// MF-17: Express serves the built React app, so the API and the screens share one origin.
// A temporary folder stands in for client/dist; the database is not used.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({ prisma: {} }));

const { createApp } = await import('../src/app.js');

const dist = mkdtempSync(path.join(tmpdir(), 'mf-dist-'));
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Managing Furniture</title>');
mkdirSync(path.join(dist, 'assets'));
writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.info("app");');

afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('serving the client', () => {
  const app = createApp({ clientDist: dist });

  it('serves index.html at /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Managing Furniture');
  });

  it('serves index.html for app routes, so a QR link opens the item page', async () => {
    const res = await request(app).get('/i/MP-00123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('serves built files', async () => {
    const res = await request(app).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  it('keeps unknown API paths as a JSON 404', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('still answers the API', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('works without a built client (local development)', async () => {
    const res = await request(createApp({ clientDist: path.join(dist, 'missing') })).get('/');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('trusts one proxy, for the real client IP behind Render', () => {
    expect(app.get('trust proxy')).toBe(1);
  });
});
