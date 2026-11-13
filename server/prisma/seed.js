// Seed data for a new installation: default settings, lookup lists and the Karaportti campus.
// With --demo it also adds a demo building with rooms (local development and the Render demo).
// Safe to run many times: it never overwrites or re-creates what an admin has changed.
// Run with: npm run db:seed   or   npm run db:seed:demo
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/db.js';

const withDemoData = process.argv.includes('--demo');

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

const DEFAULT_CAMPUS = { name: 'Karaportti', code: 'KAR' };

// Demo data only: not created in a real installation.
const DEMO_BUILDING = { name: 'D', rooms: ['D501', 'D502', 'D503', 'D504', 'D569'] };

// 02 › Security: room QR tokens are random (16 characters), never the room name.
function newQrToken() {
  return randomBytes(12).toString('base64url');
}

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

// Demo building + rooms, only when the campus has no buildings yet. Returns rooms added.
async function seedDemoLocations() {
  const campus = await prisma.campus.findUnique({
    where: { code: DEFAULT_CAMPUS.code },
    include: { _count: { select: { buildings: true } } },
  });
  if (!campus || campus._count.buildings > 0) {
    return 0;
  }

  await prisma.building.create({
    data: {
      name: DEMO_BUILDING.name,
      campusId: campus.id,
      rooms: {
        create: DEMO_BUILDING.rooms.map((name) => ({ name, qrToken: newQrToken() })),
      },
    },
  });
  return DEMO_BUILDING.rooms.length;
}

async function main() {
  await seedSettings();
  const categories = await seedListIfEmpty(prisma.category, CATEGORIES);
  const brands = await seedListIfEmpty(prisma.brand, BRANDS);
  const colours = await seedListIfEmpty(prisma.colour, COLOURS);
  const campuses = await seedListIfEmpty(prisma.campus, [DEFAULT_CAMPUS]);
  const rooms = withDemoData ? await seedDemoLocations() : 0;

  console.info(
    `Seed done. Added: ${categories} categories, ${brands} brands, ${colours} colours, ` +
      `${campuses} campuses, ${rooms} demo rooms.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}