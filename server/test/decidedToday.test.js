// GET /api/moderator/requests?tab=decided (M2 "Decided today"): moderator decisions since midnight
// in Helsinki, newest first, 25 per page. The database is mocked.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    loan: { findMany: vi.fn() },
    loanItem: { findMany: vi.fn(), count: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');
const { startOfToday } = await import('../src/services/approvalService.js');

const D751 = { id: 2, name: 'D751' };

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

function decided(id, status, code, category, decidedAt) {
  return {
    id,
    status,
    decidedAt: new Date(decidedAt),
    decidedById: 9,
    decisionNote: status === 'DECLINED' ? 'Booked for an exam.' : null,
    item: { code, name: category, category: { name: category } },
    loan: { id: 5, toRoomId: D751.id, user: { id: 7, name: 'Aino Virtanen' } },
  };
}

function getDecided(query = '?tab=decided', role = 'MODERATOR') {
  return request(createApp()).get(`/api/moderator/requests${query}`).set('Cookie', loginAs(role));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.room.findMany.mockResolvedValue([D751]);
  prisma.user.findMany.mockResolvedValue([{ id: 9, name: 'Mikko Laine' }]);
  prisma.loanItem.findMany.mockResolvedValue([
    decided(24, 'DECLINED', 'MP-03015', 'Sofa', '2026-11-18T08:16:00Z'),
    decided(23, 'APPROVED', 'MP-02210', 'Table', '2026-11-18T08:14:00Z'),
  ]);
  prisma.loanItem.count.mockResolvedValue(2);
});

describe('GET /api/moderator/requests?tab=decided', () => {
  it('is not for students', async () => {
    const res = await getDecided('?tab=decided', 'USER');
    expect(res.status).toBe(403);
    expect(prisma.loanItem.findMany).not.toHaveBeenCalled();
  });

  it('returns the M2 table: item, request, decision, decided by, when', async () => {
    const res = await getDecided();

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual({
      id: 24,
      code: 'MP-03015',
      name: 'Sofa',
      category: 'Sofa',
      decision: 'DECLINED',
      note: 'Booked for an exam.',
      decidedAt: '2026-11-18T08:16:00.000Z',
      decidedBy: { id: 9, name: 'Mikko Laine' },
      loan: { id: 5, borrower: { id: 7, name: 'Aino Virtanen' }, toRoom: D751 },
    });
    expect(res.body.data[1]).toMatchObject({ code: 'MP-02210', decision: 'APPROVED' });
  });

  it('shows an item that was approved and then returned as approved', async () => {
    prisma.loanItem.findMany.mockResolvedValue([
      decided(23, 'RETURNED', 'MP-02210', 'Table', '2026-11-18T08:14:00Z'),
    ]);
    const res = await getDecided();
    expect(res.body.data[0].decision).toBe('APPROVED');
  });

  it('asks for moderator decisions since midnight, newest first, 25 per page', async () => {
    await getDecided('?tab=decided&page=2');
    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { decidedById: { not: null }, decidedAt: { gte: expect.any(Date) } },
        orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
        skip: 25,
        take: 25,
      }),
    );
  });

  it('nothing decided today gives an empty page', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);
    prisma.loanItem.count.mockResolvedValue(0);
    const res = await getDecided();
    expect(res.body).toEqual({ data: [], total: 0 });
  });

  it('without a tab, the Waiting tab is returned as before', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    const res = await getDecided('');
    expect(res.body).toEqual({ data: [], total: 0, waitingItems: 0 });
    expect(prisma.loanItem.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown tab', '?tab=all'],
    ['page 0', '?tab=decided&page=0'],
    ['a page that is not a number', '?tab=decided&page=x'],
  ])('400 for %s', async (label, query) => {
    const res = await getDecided(query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('startOfToday', () => {
  it('is midnight in Helsinki, also when the server runs in UTC', () => {
    // 12:00 in Helsinki (UTC+2 in November) → midnight was 22:00 UTC the day before.
    expect(startOfToday('Europe/Helsinki', new Date('2026-11-18T10:00:00Z')).toISOString()).toBe(
      '2026-11-17T22:00:00.000Z',
    );
    // 00:30 in Helsinki is already the next day.
    expect(startOfToday('Europe/Helsinki', new Date('2026-11-17T22:30:00Z')).toISOString()).toBe(
      '2026-11-17T22:00:00.000Z',
    );
  });

  it('follows summer time (UTC+3)', () => {
    expect(startOfToday('Europe/Helsinki', new Date('2026-07-01T23:30:00Z')).toISOString()).toBe(
      '2026-07-01T21:00:00.000Z',
    );
  });
});
