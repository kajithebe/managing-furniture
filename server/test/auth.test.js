// Access control tests (MF-07): no session → 401, wrong role → 403.
// The database is mocked, so these tests run anywhere, including CI.
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { requireAuth, requireRole } = await import('../src/middleware/auth.js');
const { errorHandler } = await import('../src/middleware/error.js');
const { SESSION_COOKIE, startSession } = await import('../src/services/sessionService.js');

// A real session cookie for a user id, made with the same code the login uses.
function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function fakeUser(role, overrides = {}) {
  return {
    id: 7,
    email: 'test.user@metropolia.fi',
    name: 'Test User',
    role,
    active: true,
    ...overrides,
  };
}

// A small app with one route per role level, to test requireRole on its own.
function roleTestApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/user', requireAuth, (req, res) => res.json({ ok: true }));
  app.get('/moderator', requireAuth, requireRole('MODERATOR'), (req, res) =>
    res.json({ ok: true }),
  );
  app.get('/admin', requireAuth, requireRole('ADMIN'), (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  prisma.user.findUnique.mockReset();
});

describe('requireAuth', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await request(createApp()).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'NOT_LOGGED_IN', message: 'Please log in.' } });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 for a changed (tampered) session cookie', async () => {
    const res = await request(createApp())
      .get('/api/auth/me')
      .set('Cookie', `${sessionCookie(7)}x`);

    expect(res.status).toBe(401);
  });

  it('returns 401 and clears the cookie for a deactivated user', async () => {
    prisma.user.findUnique.mockResolvedValue(fakeUser('USER', { active: false }));

    const res = await request(createApp()).get('/api/auth/me').set('Cookie', sessionCookie(7));

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie'][0]).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
  });

  it('returns only the public user fields for a valid session', async () => {
    prisma.user.findUnique.mockResolvedValue(fakeUser('USER'));

    const res = await request(createApp()).get('/api/auth/me').set('Cookie', sessionCookie(7));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 7,
      email: 'test.user@metropolia.fi',
      name: 'Test User',
      role: 'USER',
    });
  });
});

describe('requireRole', () => {
  it.each([
    // role,        route,        expected status
    ['USER', '/user', 200],
    ['USER', '/moderator', 403],
    ['USER', '/admin', 403],
    ['MODERATOR', '/moderator', 200],
    ['MODERATOR', '/admin', 403],
    ['ADMIN', '/moderator', 200],
    ['ADMIN', '/admin', 200],
  ])('%s on %s → %i', async (role, route, status) => {
    prisma.user.findUnique.mockResolvedValue(fakeUser(role));

    const res = await request(roleTestApp()).get(route).set('Cookie', sessionCookie(7));

    expect(res.status).toBe(status);
    if (status === 403) {
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects an unknown role name when the route is defined', () => {
    expect(() => requireRole('MODERATER')).toThrow('Unknown role: MODERATER');
  });
});

describe('cookie settings', () => {
  it('sets an httpOnly, sameSite=lax session cookie for 8 hours', () => {
    const res = {
      cookie(name, value, options) {
        this.options = options;
      },
    };
    startSession(res, 7);

    expect(res.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
  });
});
