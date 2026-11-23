// PATCH /api/admin/users/:id (MF-24): change role, deactivate and reactivate with the A2 safety
// rules. The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const user = { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() };
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
const SEBASTIAN = { id: 1, role: 'ADMIN', active: true };
const AINO = { id: 2, role: 'USER', active: true };
const OTHER_ADMIN = { id: 5, role: 'ADMIN', active: true };

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

// The first findUnique is requireAuth loading the logged-in user, the second the target user.
function loginAs(role, target) {
  prisma.user.findUnique.mockResolvedValueOnce({
    id: 1,
    email: 'sebastian.lindsten@metropolia.fi',
    name: 'Sebastian Lindsten',
    role,
    active: true,
  });
  if (target !== undefined) {
    prisma.user.findUnique.mockResolvedValueOnce(target);
  }
  return sessionCookie(1);
}

function patchUser(cookie, id, body) {
  return request(createApp())
    .patch(`/api/admin/users/${id}`)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.update.mockImplementation(({ where, data }) =>
    Promise.resolve({
      id: where.id,
      name: 'Aino Virtanen',
      email: 'aino.virtanen@metropolia.fi',
      role: 'USER',
      active: true,
      lastLoginAt: null,
      ...data,
      _count: { loans: 1 },
    }),
  );
});

describe('PATCH /api/admin/users/:id', () => {
  it('needs a session', async () => {
    const res = await request(createApp())
      .patch('/api/admin/users/2')
      .set('Origin', ORIGIN)
      .send({ role: 'MODERATOR' });
    expect(res.status).toBe(401);
  });

  it('is for admins only', async () => {
    const res = await patchUser(loginAs('MODERATOR'), 2, { role: 'MODERATOR' });
    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('changes the role (P15) and writes the AuditLog', async () => {
    const res = await patchUser(loginAs('ADMIN', AINO), 2, { role: 'MODERATOR' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, role: 'MODERATOR', openLoans: 1 });
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 1,
        entity: 'User',
        entityId: 2,
        action: 'role_change',
        before: { role: 'USER' },
        after: { role: 'MODERATOR' },
      },
    });
  });

  it('deactivates and reactivates (P16), never deletes', async () => {
    let res = await patchUser(loginAs('ADMIN', AINO), 2, { active: false });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'deactivate',
      before: { active: true },
      after: { active: false },
    });

    res = await patchUser(loginAs('ADMIN', { ...AINO, active: false }), 2, { active: true });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create.mock.calls[1][0].data.action).toBe('reactivate');
  });

  it("refuses a change to the admin's own role (A2 wording)", async () => {
    const res = await patchUser(loginAs('ADMIN', SEBASTIAN), 1, { role: 'USER' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'OWN_ROLE', message: "You can't change your own role" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to deactivate yourself', async () => {
    const res = await patchUser(loginAs('ADMIN', SEBASTIAN), 1, { active: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWN_STATUS');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps at least one active admin (A2 wording)', async () => {
    // In real use the caller is an active admin too, so this happens only when two admins change
    // each other at the same moment. The mock gives 0 other admins to test the rule itself.
    prisma.user.count.mockResolvedValue(0);

    for (const body of [{ role: 'MODERATOR' }, { active: false }]) {
      const res = await patchUser(loginAs('ADMIN', OTHER_ADMIN), 5, body);
      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'LAST_ADMIN',
        message: 'At least one active admin is needed',
      });
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lets an admin change another admin when one more active admin remains', async () => {
    prisma.user.count.mockResolvedValue(1);

    const res = await patchUser(loginAs('ADMIN', OTHER_ADMIN), 5, { role: 'MODERATOR' });

    expect(res.status).toBe(200);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { role: 'ADMIN', active: true, id: { not: 5 } },
    });
  });

  it('tries again when PostgreSQL refuses a parallel admin change', async () => {
    const conflict = Object.assign(new Error('serialization failure'), { code: 'P2034' });
    prisma.$transaction.mockRejectedValueOnce(conflict);

    const res = await patchUser(loginAs('ADMIN', AINO), 2, { role: 'MODERATOR' });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('gives 404 for an unknown user', async () => {
    const res = await patchUser(loginAs('ADMIN', null), 99, { role: 'MODERATOR' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('needs role or active, and cannot change other fields', async () => {
    const res = await patchUser(loginAs('ADMIN'), 2, { email: 'someone@metropolia.fi' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
