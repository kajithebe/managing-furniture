// Item history report (MF-32): the filters (one item or a date range), the row shape shared with
// the dashboard's Recent activity, and the CSV. The database is mocked, so this runs anywhere.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    itemEvent: { count: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { itemHistoryCsv, itemHistoryReport, startOfDay } =
  await import('../src/services/reportService.js');

// An item event as the database returns it.
function event(overrides = {}) {
  return {
    id: 31,
    type: 'STATUS_CHANGED',
    createdAt: new Date('2026-11-08T13:20:00Z'),
    userId: 4,
    loanId: null,
    fromRoomId: null,
    toRoomId: null,
    note: 'NEEDS_REPAIR: Wobbly leg',
    item: { code: 'MP-00123', name: 'Chair' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.itemEvent.count.mockResolvedValue(0);
  prisma.itemEvent.findMany.mockResolvedValue([]);
  prisma.user.findMany.mockResolvedValue([{ id: 4, name: 'Mikko Laine' }]);
  prisma.room.findMany.mockResolvedValue([
    { id: 1, name: 'D569' },
    { id: 6, name: 'D751' },
  ]);
});

describe('itemHistoryReport', () => {
  it('filters by item code and date range and pages the results', async () => {
    await itemHistoryReport({
      code: 'MP-00123',
      from: '2026-11-01',
      to: '2026-11-30',
      page: 3,
      pageSize: 25,
    });

    const where = {
      AND: [
        { item: { code: 'MP-00123' } },
        { createdAt: { gte: startOfDay('2026-11-01') } },
        { createdAt: { lt: startOfDay('2026-12-01') } },
      ],
    };
    expect(prisma.itemEvent.count).toHaveBeenCalledWith({ where });
    expect(prisma.itemEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 50,
        take: 25,
      }),
    );
  });

  it('shows every event when no filter is chosen', async () => {
    await itemHistoryReport({ page: 1, pageSize: 25 });
    expect(prisma.itemEvent.count).toHaveBeenCalledWith({ where: { AND: [] } });
  });

  it('returns rows with user and room names, and splits a status note', async () => {
    prisma.itemEvent.count.mockResolvedValue(2);
    prisma.itemEvent.findMany.mockResolvedValue([
      event(),
      event({
        id: 30,
        type: 'BORROWED',
        createdAt: new Date('2026-11-07T12:00:00Z'),
        userId: null,
        loanId: 5,
        fromRoomId: 1,
        toRoomId: 6,
        note: 'Group work',
      }),
    ]);

    const result = await itemHistoryReport({ code: 'MP-00123', page: 1, pageSize: 25 });

    expect(result).toEqual({
      total: 2,
      data: [
        {
          id: 31,
          type: 'STATUS_CHANGED',
          createdAt: new Date('2026-11-08T13:20:00Z'),
          user: { id: 4, name: 'Mikko Laine' },
          item: { code: 'MP-00123', name: 'Chair' },
          loanId: null,
          fromRoom: null,
          toRoom: null,
          condition: 'NEEDS_REPAIR',
          note: 'Wobbly leg',
        },
        {
          id: 30,
          type: 'BORROWED',
          createdAt: new Date('2026-11-07T12:00:00Z'),
          user: null,
          item: { code: 'MP-00123', name: 'Chair' },
          loanId: 5,
          fromRoom: { id: 1, name: 'D569' },
          toRoom: { id: 6, name: 'D751' },
          condition: null,
          note: 'Group work',
        },
      ],
    });
  });
});

describe('itemHistoryCsv', () => {
  it('writes every matching event with times in Helsinki and guards formulas', async () => {
    prisma.itemEvent.findMany.mockResolvedValue([
      event(),
      event({
        id: 29,
        type: 'LOCATION_CORRECTED',
        createdAt: new Date('2026-11-05T12:00:00Z'),
        fromRoomId: 6,
        toRoomId: 1,
        note: '-found in corridor',
      }),
      event({ id: 28, type: 'OVERDUE', userId: null, note: null }),
    ]);

    const csv = await itemHistoryCsv({ code: 'MP-00123' });
    const lines = csv.replace('﻿', '').trim().split('\r\n');

    expect(prisma.itemEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ item: { code: 'MP-00123' } }] }, take: 20000 }),
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines).toEqual([
      'Date;Item;Code;Event;User;From;To;Note',
      // 13:20 UTC is 15:20 in Helsinki.
      '2026-11-08 15:20;Chair;MP-00123;Status changed to Needs repair;Mikko Laine;;;Wobbly leg',
      // A note starting with - gets a leading ', so Excel shows it as text.
      "2026-11-05 14:00;Chair;MP-00123;Location corrected;Mikko Laine;D751;D569;'-found in corridor",
      // The job marks items late, so there is no user.
      '2026-11-08 15:20;Chair;MP-00123;Not yet returned;;;;',
    ]);
  });
});
