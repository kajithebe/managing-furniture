// GET /api/lookups: the dropdown lists plus loanRules { maxLoanHours } for the S4 borrow form
// ("Longest allowed: 4 hours" and the until times). Any logged-in user may read it.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    category: { findMany: vi.fn() },
    brand: { findMany: vi.fn() },
    colour: { findMany: vi.fn() },
    campus: { findMany: vi.fn() },
    setting: { findUniqueOrThrow: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const USER_ID = 7;

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
    id: USER_ID,
    email: 'aino.virtanen@metropolia.fi',
    name: 'Aino Virtanen',
    role,
    active: true,
  });
  return sessionCookie(USER_ID);
}

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  prisma.category.findMany.mockResolvedValue([
    { id: 1, name: 'Chair', code: 'CHR', autoApprove: true },
  ]);
  prisma.brand.findMany.mockResolvedValue([{ id: 1, name: 'Isku', code: 'ISK' }]);
  prisma.colour.findMany.mockResolvedValue([{ id: 1, name: 'Grey', code: 'GRY' }]);
  prisma.campus.findMany.mockResolvedValue([
    {
      id: 1,
      name: 'Karaportti',
      code: 'KAR',
      buildings: [{ id: 1, name: 'D', rooms: [{ id: 1, name: 'D569' }] }],
    },
  ]);
  prisma.setting.findUniqueOrThrow.mockResolvedValue({ maxLoanHours: 3 });
});

describe('GET /api/lookups', () => {
  it('needs a session (401)', async () => {
    const res = await request(app).get('/api/lookups');
    expect(res.status).toBe(401);
    expect(prisma.setting.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('returns the longest loan time from the settings to a student', async () => {
    const res = await request(app).get('/api/lookups').set('Cookie', loginAs('USER'));
    expect(res.status).toBe(200);
    expect(res.body.loanRules).toEqual({ maxLoanHours: 3 });
    expect(prisma.setting.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { maxLoanHours: true },
    });
  });

  it('returns only maxLoanHours from the settings, nothing else', async () => {
    prisma.setting.findUniqueOrThrow.mockResolvedValue({ maxLoanHours: 4 });
    const res = await request(app).get('/api/lookups').set('Cookie', loginAs('USER'));
    expect(Object.keys(res.body.loanRules)).toEqual(['maxLoanHours']);
    expect(res.body.loanRules.maxLoanHours).toBe(4);
  });

  it('keeps the dropdown lists as before', async () => {
    const res = await request(app).get('/api/lookups').set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['brands', 'campuses', 'categories', 'colours', 'loanRules'].sort(),
    );
    expect(res.body.categories[0]).toEqual({
      id: 1,
      name: 'Chair',
      code: 'CHR',
      autoApprove: true,
    });
    expect(res.body.campuses[0].buildings[0].rooms).toEqual([{ id: 1, name: 'D569' }]);
  });
});
