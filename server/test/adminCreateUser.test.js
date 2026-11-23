// POST /api/admin/users (MF-24): P14 Add user – add a user in advance with a role.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const user = { findUnique: vi.fn(), create: vi.fn() };
  const auditLog = { create: vi.fn() };
  return {
    prisma: {
      user,
      auditLog,
      // The service's transaction callback gets the same mocks as tx.
      $transaction: vi.fn((callback) => callback({ user, auditLog })),
    },
  };
});

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
const ADMIN = {
  id: 1,
  email: 'sebastian.lindsten@metropolia.fi',
  name: 'Sebastian Lindsten',
  role: 'ADMIN',
  active: true,
};

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

// The first findUnique is requireAuth loading the logged-in user.
function loginAs(role) {
  prisma.user.findUnique.mockResolvedValueOnce({ ...ADMIN, role });
  return sessionCookie(ADMIN.id);
}

function addUser(cookie, body) {
  return request(createApp())
    .post('/api/admin/users')
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: 4,
      ...data,
      active: true,
      lastLoginAt: null,
      _count: { loans: 0 },
    }),
  );
});

describe('POST /api/admin/users', () => {
  it('needs a session', async () => {
    const res = await request(createApp())
      .post('/api/admin/users')
      .set('Origin', ORIGIN)
      .send({ email: 'aino.virtanen@metropolia.fi' });
    expect(res.status).toBe(401);
  });

  it('is for admins only', async () => {
    const res = await addUser(loginAs('MODERATOR'), { email: 'aino.virtanen@metropolia.fi' });
    expect(res.status).toBe(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('adds the user with the role and writes the AuditLog', async () => {
    const res = await addUser(loginAs('ADMIN'), {
      email: '  Aino.Virtanen@Metropolia.fi ',
      name: 'Aino Virtanen',
      role: 'MODERATOR',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 4,
      email: 'aino.virtanen@metropolia.fi',
      name: 'Aino Virtanen',
      role: 'MODERATOR',
      active: true,
      lastLoginAt: null,
      openLoans: 0,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 1,
        entity: 'User',
        entityId: 4,
        action: 'create',
        after: { email: 'aino.virtanen@metropolia.fi', name: 'Aino Virtanen', role: 'MODERATOR' },
      },
    });
  });

  it('uses role User and the name from the email when they are left out', async () => {
    const res = await addUser(loginAs('ADMIN'), { email: 'aino.virtanen@metropolia.fi', name: '' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('USER');
    expect(res.body.name).toBe('Aino Virtanen');
  });

  it('only accepts @metropolia.fi addresses (P14 wording)', async () => {
    for (const email of ['aino@example.com', '@metropolia.fi', 'aino']) {
      const res = await addUser(loginAs('ADMIN'), { email });
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'EMAIL_DOMAIN_NOT_ALLOWED',
        message: 'Use your @metropolia.fi address',
      });
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses an email that already has an account', async () => {
    const cookie = loginAs('ADMIN');
    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, name: 'Aino Virtanen' });

    const res = await addUser(cookie, { email: 'aino.virtanen@metropolia.fi' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      existing: { id: 2, name: 'Aino Virtanen' },
      code: 'EMAIL_TAKEN',
      message: 'aino.virtanen@metropolia.fi already has an account',
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('cannot set other fields such as active', async () => {
    await addUser(loginAs('ADMIN'), { email: 'aino.virtanen@metropolia.fi', active: false });

    expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty('active');
  });

  it('rejects an unknown role', async () => {
    const res = await addUser(loginAs('ADMIN'), {
      email: 'aino.virtanen@metropolia.fi',
      role: 'OWNER',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
