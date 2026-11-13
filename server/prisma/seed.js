// Seed data for a new installation: default settings and lookup lists.
// Safe to run many times: it never overwrites or re-creates what an admin has changed.
// Run with: npm run db:seed
import { prisma } from '../src/db.js';

// 02 › Asset codes: default scheme MP-00001
const DEFAULT_CODE_SCHEME = {
  segments: [{ type: 'text', value: 'MP' }, { type: 'number' }],
  separator: '-',
  numberLength: 5,
};

// Short codes follow shortCodeService: first letter + following consonants, up to 3.
const CATEGORIES = [
  { name: 'Chair', code: 'CHR', autoApprove: true },
  { name: 'Stool', code: 'STL', autoApprove: true },
  { name: 'Table', code: 'TBL', autoApprove: false },
  { name: 'Sofa', code: 'SF', autoApprove: false },
  { name: 'Cabinet', code: 'CBN', autoApprove: false },
  { name: 'Shelf', code: 'SHL', autoApprove: false },
];

const BRANDS = [
  { name: 'Isku', code: 'ISK' },
  { name: 'Martela', code: 'MRT' },
  { name: 'IKEA', code: 'IK' },
];

const COLOURS = [
  { name: 'Black', code: 'BLC' },
  { name: 'White', code: 'WHT' },
  { name: 'Grey', code: 'GRY' },
  { name: 'Blue', code: 'BL' },
  { name: 'Green', code: 'GRN' },
  { name: 'Red', code: 'RD' },
];

// The single settings row: created once, never overwritten (admins change it in Settings).
async function seedSettings() {
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, codeScheme: DEFAULT_CODE_SCHEME },
  });
}

// A list is filled only when it is empty (first install), so renamed or archived
// entries are never created again. Returns how many rows were added.
async function seedListIfEmpty(model, rows) {
  if ((await model.count()) > 0) {
    return 0;
  }
  const { count } = await model.createMany({ data: rows });
  return count;
}

async function main() {
  await seedSettings();
  const categories = await seedListIfEmpty(prisma.category, CATEGORIES);
  const brands = await seedListIfEmpty(prisma.brand, BRANDS);
  const colours = await seedListIfEmpty(prisma.colour, COLOURS);

  console.info(
    `Seed done. Added: ${categories} categories, ${brands} brands, ${colours} colours.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}