// Lookup lists for dropdowns: categories, brands, colours and campuses → buildings → rooms.
// Only non-archived entries are returned, sorted by name.
// loanRules: the longest loan time, so the S4 borrow form can offer only allowed until times
// and show "Longest allowed: 4 hours" (decided 19 Nov 2026).
import { prisma } from '../db.js';

const byName = { orderBy: { name: 'asc' } };
const notArchived = { where: { archived: false } };

export async function getLookups() {
  const [categories, brands, colours, campuses, setting] = await Promise.all([
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
    prisma.setting.findUniqueOrThrow({ where: { id: 1 }, select: { maxLoanHours: true } }),
  ]);

  return {
    categories,
    brands,
    colours,
    campuses,
    loanRules: { maxLoanHours: setting.maxLoanHours },
  };
}
