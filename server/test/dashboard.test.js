// GET /api/moderator/dashboard (MF-31): M1 Dashboard for moderators and admins.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    loanItem: { count: vi.fn() },
    item: { count: vi.fn() },
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
    id: 9,
    email: 'mikko.laine@metropolia.fi',
    name: 'Mikko Laine',
    role,
    active: true,
  });
  return sessionCookie(9);
}

// The M1 tiles: 3 waiting, 2 not yet returned, 41 on loan, 9,812 items.
function mockCounts() {
  prisma.loanItem.count.mockImplementation(({ where }) =>
    Promise.resolve(where.status === 'PENDING' ? 3 : 2),
  );
  prisma.item.count.mockImplementation(({ where }) => Promise.resolve(where.onLoan ? 41 : 9812));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCounts();
});

describe('GET /api/moderator/dashboard', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/moderator/dashboard');
    expect(res.status).toBe(401);
  });

  it('is not for students', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('USER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it('is for admins too', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('ADMIN'));
    expect(res.status).toBe(200);
  });

  it('returns the four tile counts (M1)', async () => {
    const res = await request(createApp())
      .get('/api/moderator/dashboard')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.body.tiles).toEqual({
      waitingForApproval: 3,
      notYetReturned: 2,
      onLoanNow: 41,
      totalItems: 9812,
    });
    // "Updated 10:15 · Refresh"
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('counts with the right filters', async () => {
    await request(createApp()).get('/api/moderator/dashboard').set('Cookie', loginAs('MODERATOR'));

    expect(prisma.loanItem.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect(prisma.loanItem.count).toHaveBeenCalledWith({ where: { status: 'OVERDUE' } });
    expect(prisma.item.count).toHaveBeenCalledWith({ where: { onLoan: true } });
    // Disposed items are not counted, as in the items list.
    expect(prisma.item.count).toHaveBeenCalledWith({
      where: { condition: { not: 'DISPOSED' } },
    });
  });
});
