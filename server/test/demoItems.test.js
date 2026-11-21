// seed --demo: demo items in building D (prisma/demoItems.js), with a fake database.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ITEMS, DEMO_NOTE, seedDemoItems } from '../prisma/demoItems.js';

const TOTAL = DEMO_ITEMS.reduce((sum, group) => sum + (group.quantity ?? 1), 0);

let db;
let saved;

function fakeDb({ existingDemoItems = 0, nextNumber = 5, rooms } = {}) {
  saved = { items: [], events: [], nextNumber };
  const tx = {
    setting: {
      update: vi.fn(async ({ data }) => {
        saved.nextNumber += data.nextNumber.increment;
        return {
          nextNumber: saved.nextNumber,
          codeScheme: {
            segments: [{ type: 'text', value: 'MP' }, { type: 'number' }],
            separator: '-',
            numberLength: 5,
          },
        };
      }),
    },
    item: {
      findFirst: vi.fn(async () => null),
      createManyAndReturn: vi.fn(async ({ data }) => {
        const items = data.map((row, i) => ({ id: 100 + i, ...row }));
        saved.items.push(...items);
        return items.map(({ id, currentRoomId }) => ({ id, currentRoomId }));
      }),
    },
    itemEvent: {
      createMany: vi.fn(async ({ data }) => {
        saved.events.push(...data);
        return { count: data.length };
      }),
    },
  };
  return {
    item: { count: vi.fn(async () => existingDemoItems) },
    category: {
      findMany: vi.fn(async () => [
        { id: 1, code: 'CHR', name: 'Chair' },
        { id: 2, code: 'STL', name: 'Stool' },
        { id: 3, code: 'TBL', name: 'Table' },
        { id: 4, code: 'SF', name: 'Sofa' },
        { id: 5, code: 'CBN', name: 'Cabinet' },
      ]),
    },
    brand: {
      findMany: vi.fn(async () => [
        { id: 1, code: 'ISK' },
        { id: 2, code: 'MRT' },
        { id: 3, code: 'IK' },
      ]),
    },
    colour: {
      findMany: vi.fn(async () => [
        { id: 1, code: 'BLC' },
        { id: 2, code: 'WHT' },
        { id: 3, code: 'GRY' },
      ]),
    },
    room: {
      findMany: vi.fn(
        async () =>
          rooms ??
          ['D501', 'D502', 'D503', 'D504', 'D569'].map((name, i) => ({ id: 11 + i, name })),
      ),
    },
    $transaction: vi.fn((callback) => callback(tx)),
    tx,
  };
}

beforeEach(() => {
  db = fakeDb();
});

describe('seedDemoItems', () => {
  it('adds all demo items with codes that continue the running number', async () => {
    const added = await seedDemoItems(db, 'KAR');

    expect(added).toBe(TOTAL);
    expect(saved.items).toHaveLength(TOTAL);
    expect(saved.items[0].code).toBe('MP-00005');
    expect(saved.items.at(-1).code).toBe(`MP-${String(4 + TOTAL).padStart(5, '0')}`);
    expect(new Set(saved.items.map((item) => item.code)).size).toBe(TOTAL);
    expect(saved.items.every((item) => item.notes === DEMO_NOTE)).toBe(true);
  });

  it('puts every item in its home room, with the right category and status', async () => {
    await seedDemoItems(db, 'KAR');
    const chairs = saved.items.filter((item) => item.categoryId === 1);

    expect(saved.items.every((item) => item.currentRoomId === item.homeRoomId)).toBe(true);
    expect(chairs).toHaveLength(9);
    expect(chairs[0]).toMatchObject({ name: 'Chair', homeRoomId: 15, condition: 'GOOD' });
    expect(saved.items.map((item) => item.condition)).toEqual(
      expect.arrayContaining(['GOOD', 'NEEDS_REPAIR', 'BROKEN', 'IN_REPAIR']),
    );
  });

  it('follows the wheels rule: wheel count only when the item has wheels', async () => {
    await seedDemoItems(db, 'KAR');
    const withWheels = saved.items.filter((item) => item.hasWheels);

    expect(withWheels).toHaveLength(2);
    expect(withWheels.every((item) => item.wheelCount === 5)).toBe(true);
    expect(
      saved.items.filter((item) => !item.hasWheels).every((item) => item.wheelCount === null),
    ).toBe(true);
  });

  it('writes one CREATED event per item', async () => {
    await seedDemoItems(db, 'KAR');

    expect(saved.events).toHaveLength(TOTAL);
    expect(saved.events[0]).toEqual({ itemId: 100, type: 'CREATED', toRoomId: 15 });
  });

  it('adds nothing when the demo items exist already (safe to run on every start)', async () => {
    db = fakeDb({ existingDemoItems: 3 });

    expect(await seedDemoItems(db, 'KAR')).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.item.count).toHaveBeenCalledWith({ where: { notes: DEMO_NOTE } });
  });

  it('skips groups whose room is missing, and adds nothing without demo rooms', async () => {
    db = fakeDb({ rooms: [{ id: 15, name: 'D569' }] });
    const added = await seedDemoItems(db, 'KAR');
    expect(added).toBe(saved.items.length);
    expect(saved.items.every((item) => item.homeRoomId === 15)).toBe(true);

    db = fakeDb({ rooms: [] });
    expect(await seedDemoItems(db, 'KAR')).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('only looks at rooms of the given campus', async () => {
    await seedDemoItems(db, 'KAR');
    expect(db.room.findMany).toHaveBeenCalledWith({
      where: { building: { campus: { code: 'KAR' } } },
      select: { id: true, name: true },
    });
  });
});
