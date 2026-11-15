// Lookup lists for dropdowns: categories, brands, colours and campuses → buildings → rooms.
// Only non-archived entries are returned, sorted by name.
import { prisma } from '../db.js';

const byName = { orderBy: { name: 'asc' } };
const notArchived = { where: { archived: false } };

export async function getLookups() {
  const [categories, brands, colours, campuses] = await Promise.all([
    prisma.category.findMany({
      ...notArchived,
      ...byName,
      select: { id: true, name: true, code: true, autoApprove: true },
    }),
    prisma.brand.findMany({
      ...notArchived,
      ...byName,
      select: { id: true, name: true, code: true },
    }),
    prisma.colour.findMany({
      ...notArchived,
      ...byName,
      select: { id: true, name: true, code: true },
    }),
    prisma.campus.findMany({
      ...notArchived,
      ...byName,
      select: {
        id: true,
        name: true,
        code: true,
        buildings: {
          ...notArchived,
          ...byName,
          select: {
            id: true,
            name: true,
            // qrToken is left out on purpose: door QR tokens are only shown on printed labels.
            rooms: { ...notArchived, ...byName, select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return { categories, brands, colours, campuses };
}
