// GET /api/admin/audit (MF-24): the AuditLog for A2 "View history", newest first, 25 per page.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((queries) => Promise.all(queries)),
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function loginAs(role) {
  prisma.user.findUnique.mockResolvedValue({
    id: 1,
    email: 'sebastian.lindsten@metropolia.fi',
    name: 'Sebastian Lindsten',
    role,
    active: true,
  });
  return sessionCookie(1);
}

const roleChange = {
  id: 12,
  actorId: 1,
  entity: 'User',
  entityId: 3,
  action: 'role_change',
  before: { role: 'USER' },
  after: { role: 'MODERATOR' },
  createdAt: new Date('2026-11-23T18:35:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.auditLog.findMany.mockResolvedValue([roleChange]);
  prisma.auditLog.count.mockResolvedValue(1);
  prisma.user.findMany.mockResolvedValue([{ id: 1, name: 'Sebastian Lindsten' }]);
});

describe('GET /api/admin/audit', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/admin/audit');
    expect(res.status).toBe(401);
  });

  it('is for admins only', async () => {
    const res = await request(createApp())
      .get('/api/admin/audit')
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(403);
  });

  it('returns rows with the actor name, newest first', async () => {
    const res = await request(createApp())
      .get('/api/admin/audit?entity=User&entityId=3')
      .set('Cookie', loginAs('ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        {
          id: 12,
          createdAt: '2026-11-23T18:35:00.000Z',
          entity: 'User',
          entityId: 3,
          action: 'role_change',
          actor: { id: 1, name: 'Sebastian Lindsten' },
          before: { role: 'USER' },
          after: { role: 'MODERATOR' },
        },
      ],
      total: 1,
    });

    const query = prisma.auditLog.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ entity: 'User', entityId: 3 });
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(query.skip).toBe(0);
    expect(query.take).toBe(25);
  });

  it('pages and lists everything without filters', async () => {
    await request(createApp()).get('/api/admin/audit?page=3').set('Cookie', loginAs('ADMIN'));

    const query = prisma.auditLog.findMany.mock.calls[0][0];
    expect(query.where).toEqual({});
    expect(query.skip).toBe(50);
  });

  it('rejects entityId without entity and odd entity names', async () => {
    for (const path of ['/api/admin/audit?entityId=3', '/api/admin/audit?entity=User;DROP']) {
      const res = await request(createApp()).get(path).set('Cookie', loginAs('ADMIN'));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
