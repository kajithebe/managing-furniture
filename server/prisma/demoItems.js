// Demo items for the Render demo and local development (seed --demo only, never in a real
// installation). Fake data: a few chairs, stools, tables, a sofa and a cabinet in building D,
// in every status the screens show, so the labels, the item page, borrowing, approvals and the
// reports can be tried on a fresh demo database.
// Codes come from the normal code scheme (reserveCodes), so the running number stays correct.
import { reserveCodes } from '../src/services/codeService.js';

// Marks the demo items, so the seed adds them only once (also on a database that already
// has items, e.g. ones a moderator added by hand).
export const DEMO_NOTE = 'Demo item';

// category / brand / colour: short codes from seed.js; room: a demo room of building D.
export const DEMO_ITEMS = [
  { category: 'CHR', brand: 'ISK', colour: 'GRY', room: 'D569', quantity: 6 },
  { category: 'CHR', brand: 'ISK', colour: 'GRY', room: 'D569', condition: 'NEEDS_REPAIR' },
  { category: 'CHR', brand: 'MRT', colour: 'BLC', room: 'D501', quantity: 2, wheels: 5 },
  { category: 'STL', brand: 'IK', colour: 'WHT', room: 'D502', quantity: 2 },
  { category: 'TBL', brand: 'MRT', colour: 'WHT', room: 'D569', quantity: 2 },
  { category: 'TBL', brand: 'MRT', colour: 'WHT', room: 'D569', condition: 'BROKEN' },
  { category: 'SF', brand: 'ISK', colour: 'GRY', room: 'D503' },
  { category: 'CBN', brand: 'IK', colour: 'WHT', room: 'D504', condition: 'IN_REPAIR' },
];

// Adds the demo items in one transaction. Returns how many were added (0 if they exist
// already, or if the demo rooms or lists are missing, e.g. renamed by an admin).
export async function seedDemoItems(prisma, campusCode) {
  if ((await prisma.item.count({ where: { notes: DEMO_NOTE } })) > 0) {
    return 0;
  }

  const [categories, brands, colours, rooms] = await Promise.all([
    prisma.category.findMany({ select: { id: true, code: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, code: true } }),
    prisma.colour.findMany({ select: { id: true, code: true } }),
    prisma.room.findMany({
      where: { building: { campus: { code: campusCode } } },
      select: { id: true, name: true },
    }),
  ]);
  const byCode = (list) => new Map(list.map((row) => [row.code, row]));
  const category = byCode(categories);
  const brand = byCode(brands);
  const colour = byCode(colours);
  const room = new Map(rooms.map((row) => [row.name, row]));

  // One row per item; a group whose category or room is missing is left out.
  const rows = DEMO_ITEMS.filter((g) => category.has(g.category) && room.has(g.room)).flatMap(
    (group) =>
      Array.from({ length: group.quantity ?? 1 }, () => ({
        name: category.get(group.category).name,
        categoryId: category.get(group.category).id,
        brandId: brand.get(group.brand)?.id ?? null,
        colourId: colour.get(group.colour)?.id ?? null,
        hasWheels: Boolean(group.wheels),
        wheelCount: group.wheels ?? null,
        homeRoomId: room.get(group.room).id,
        currentRoomId: room.get(group.room).id,
        condition: group.condition ?? 'GOOD',
        notes: DEMO_NOTE,
      })),
  );
  if (rows.length === 0) {
    return 0;
  }

  // Codes, items and their CREATED events together, or nothing (like POST /api/items).
  return prisma.$transaction(async (tx) => {
    const codes = await reserveCodes(tx, rows.length);
    const items = await tx.item.createManyAndReturn({
      data: rows.map((row, i) => ({ ...row, code: codes[i] })),
      select: { id: true, currentRoomId: true },
    });
    await tx.itemEvent.createMany({
      data: items.map((item) => ({
        itemId: item.id,
        type: 'CREATED',
        toRoomId: item.currentRoomId,
      })),
    });
    return items.length;
  });
}
