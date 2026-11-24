// The reminders job's work (MF-20). The database is mocked, so these tests run anywhere.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const prisma = {
    loanItem: { findMany: vi.fn(), updateMany: vi.fn() },
    itemEvent: { create: vi.fn() },
  };
  // The transaction callback gets the same mocked client.
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  return { prisma };
});

const { prisma } = await import('../src/db.js');
const { markOverdue } = await import('../src/services/reminderService.js');

const NOW = new Date('2026-11-09T12:05:00Z');
const DUE = new Date('2026-11-09T12:00:00Z');

function row(id, overrides = {}) {
  return {
    id,
    loanId: 5,
    status: 'APPROVED',
    itemId: id + 100,
    loan: { dueAt: DUE },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loanItem.updateMany.mockResolvedValue({ count: 1 });
});

describe('markOverdue', () => {
  it('asks only for items on loan whose due time has passed', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    await markOverdue(NOW);

    expect(prisma.loanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'APPROVED', loan: { dueAt: { lte: NOW } } } }),
    );
  });

  it('marks late items OVERDUE and writes one OVERDUE event each', async () => {
    prisma.loanItem.findMany.mockResolvedValue([row(21), row(22)]);

    const marked = await markOverdue(NOW);

    expect(marked).toBe(2);
    expect(prisma.loanItem.updateMany).toHaveBeenCalledWith({
      where: { id: 21, status: 'APPROVED' },
      data: { status: 'OVERDUE' },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledWith({
      data: { itemId: 121, type: 'OVERDUE', loanId: 5 },
    });
    expect(prisma.itemEvent.create).toHaveBeenCalledTimes(2);
  });

  it('leaves an item alone that was returned at the same moment', async () => {
    prisma.loanItem.findMany.mockResolvedValue([row(21)]);
    prisma.loanItem.updateMany.mockResolvedValue({ count: 0 });

    const marked = await markOverdue(NOW);

    expect(marked).toBe(0);
    expect(prisma.itemEvent.create).not.toHaveBeenCalled();
  });

  it('does nothing when no item is late', async () => {
    prisma.loanItem.findMany.mockResolvedValue([]);

    expect(await markOverdue(NOW)).toBe(0);
    expect(prisma.loanItem.updateMany).not.toHaveBeenCalled();
  });
});
