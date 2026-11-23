// GET /api/admin/users (MF-24): A2 Users list with search, filters, sorting and paging.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
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

function row(id, name, role, openLoans) {
  return {
    id,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@metropolia.fi`,
    role,
    active: true,
    lastLoginAt: new Date('2026-11-09T07:56:00Z'),
    _count: { loans: openLoans },
  };
}

const aino = row(2, 'Aino Virtanen', 'USER', 1);
const mikko = row(3, 'Mikko Laine', 'MODERATOR', 0);
const sebastian = row(1, 'Sebastian Lindsten', 'ADMIN', 0);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.count.mockResolvedValueOnce(312).mockResolvedValueOnce(1);
  prisma.user.findMany.mockResolvedValue([aino, mikko, sebastian]);
});

describe('GET /api/admin/users', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('is for admins only', async () => {
    for (const role of ['USER', 'MODERATOR']) {
      const res = await request(createApp()).get('/api/admin/users').set('Cookie', loginAs(role));
      expect(res.status).toBe(403);
    }
  });

  it('returns one page of rows with open loans, the total and the active admin count', async () => {
    const res = await request(createApp()).get('/api/admin/users').set('Cookie', loginAs('ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(312);
    expect(res.body.activeAdmins).toBe(1);
    expect(res.body.data[0]).toEqual({
      id: 2,
      name: 'Aino Virtanen',
      email: 'aino.virtanen@metropolia.fi',
      role: 'USER',
      active: true,
      lastLoginAt: '2026-11-09T07:56:00.000Z',
      openLoans: 1,
    });

    // Default: sorted by name, 25 per page, first page.
    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query.orderBy).toEqual([{ name: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]);
    expect(query.skip).toBe(0);
    expect(query.take).toBe(25);
  });

  it('searches name or email and filters by role and status', async () => {
    await request(createApp())
      .get('/api/admin/users?q=aino&role=USER&status=DEACTIVATED&page=2')
      .set('Cookie', loginAs('ADMIN'));

    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query.where.AND).toEqual([
      {
        OR: [
          { name: { contains: 'aino', mode: 'insensitive' } },
          { email: { contains: 'aino', mode: 'insensitive' } },
        ],
      },
      { role: 'USER' },
      { active: false },
    ]);
    expect(query.skip).toBe(25);
  });

  it('sorts by open loans', async () => {
    const res = await request(createApp())
      .get('/api/admin/users?sort=openLoans&order=desc')
      .set('Cookie', loginAs('ADMIN'));

    expect(res.body.data.map((user) => user.id)).toEqual([2, 1, 3]);
  });

  it('rejects unknown filter values', async () => {
    const res = await request(createApp())
      .get('/api/admin/users?role=OWNER')
      .set('Cookie', loginAs('ADMIN'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
