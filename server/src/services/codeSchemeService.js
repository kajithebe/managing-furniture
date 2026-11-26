// Settings → Asset codes (A1, MF-21): read, preview and save the code scheme.
// A saved scheme is used only for items created afterwards; existing codes never change.
// Every save is written to the AuditLog, which also gives A1 its
// "Last changed by Sebastian Lindsten, 5 Nov 2026" line.
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { logChange } from './auditService.js';
import {
  buildCode,
  CODE_MAX_LENGTH,
  codeTooLong,
  DEFAULT_CODE_SCHEME,
  longestCodeLength,
  yearPart,
} from './codeService.js';

const SETTINGS_ID = 1;
export const CODE_SCHEME_ACTION = 'code_scheme_change';

// A1 shows "! This code is longer than 20 characters." above this length (01 › Asset codes).
export const CODE_WARNING_LENGTH = 20;

async function readSetting(select) {
  const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_ID }, select });
  if (!setting) {
    throw new AppError(500, 'SETTINGS_MISSING', 'Settings are missing. Run the seed.');
  }
  return setting;
}

// Real data for the preview: up to three items with different categories, newest first
// (Disposed items left out). With items in only one or two categories there are only one or
// two examples. A new install with no items yet uses the first categories and the first campus
// instead, without brand and colour.
async function exampleParts() {
  const items = await prisma.item.findMany({
    where: { condition: { not: 'DISPOSED' } },
    distinct: ['categoryId'],
    orderBy: { id: 'desc' },
    take: 3,
    select: {
      category: { select: { code: true } },
      brand: { select: { code: true } },
      colour: { select: { code: true } },
      homeRoom: { select: { building: { select: { campus: { select: { code: true } } } } } },
    },
  });
  if (items.length) {
    return items.map((item) => ({
      campus: item.homeRoom.building.campus.code,
      category: item.category.code,
      brand: item.brand?.code ?? null,
      colour: item.colour?.code ?? null,
    }));
  }

  const [categories, campus] = await Promise.all([
    prisma.category.findMany({
      where: { archived: false },
      orderBy: { id: 'asc' },
      take: 3,
      select: { code: true },
    }),
    prisma.campus.findFirst({
      where: { archived: false },
      orderBy: { id: 'asc' },
      select: { code: true },
    }),
  ]);
  return categories.map((category) => ({
    campus: campus?.code ?? null,
    category: category.code,
    brand: null,
    colour: null,
  }));
}

// The longest short code in each list today (archived entries included, because their
// codes can still be in use): { campus, category, brand, colour }.
async function shortCodeLengths() {
  const select = { code: true };
  const [campuses, categories, brands, colours] = await Promise.all([
    prisma.campus.findMany({ select }),
    prisma.category.findMany({ select }),
    prisma.brand.findMany({ select }),
    prisma.colour.findMany({ select }),
  ]);
  const longest = (rows) => Math.max(0, ...rows.map((row) => row.code.length));
  return {
    campus: longest(campuses),
    category: longest(categories),
    brand: longest(brands),
    colour: longest(colours),
  };
}

// True when the scheme could make a code longer than 30 characters with today's short codes.
async function isOverLimit(scheme) {
  return longestCodeLength(scheme, await shortCodeLengths()) > CODE_MAX_LENGTH;
}

// The live preview of a scheme (A1 "LIVE PREVIEW" and the "Save new code format?" pop-up):
// - sample: the format with running number 1, e.g. "KAR-CHR-00001", from the first example
// - examples: up to three codes the next new items would get, e.g. "KAR-CHR-00124"
// - tooLong: a code is longer than 20 characters (the A1 warning; saving still works)
// - overLimit: a code could be longer than 30 characters, so saving is refused
// Read only: nothing is saved and no running numbers are used up.
export async function previewScheme(scheme) {
  const [{ nextNumber }, examplesParts, overLimit] = await Promise.all([
    readSetting({ nextNumber: true }),
    exampleParts(),
    isOverLimit(scheme),
  ]);
  const year = yearPart(new Date(), env.TZ);

  const sample = buildCode(scheme, 1, { ...examplesParts[0], year });
  const examples = examplesParts.map((parts, i) =>
    buildCode(scheme, nextNumber + i, { ...parts, year }),
  );
  const tooLong = [sample, ...examples].some((code) => code.length > CODE_WARNING_LENGTH);
  return { sample, examples, tooLong, overLimit };
}

// The newest code scheme change → { at, by: { id, name } }, or null if it was never changed.
async function lastChange() {
  const row = await prisma.auditLog.findFirst({
    where: { entity: 'Setting', action: CODE_SCHEME_ACTION },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { actorId: true, createdAt: true },
  });
  if (!row) return null;

  // AuditLog has no relation to User (only actorId), so the name is read separately.
  const actor = await prisma.user.findUnique({
    where: { id: row.actorId },
    select: { id: true, name: true },
  });
  return { at: row.createdAt, by: { id: row.actorId, name: actor?.name ?? null } };
}

// GET /api/admin/code-scheme → { scheme, format, defaultScheme, lastChanged }
// format is the saved scheme as a code, e.g. "MP-00001" (A1 "Current format").
// defaultScheme is what "Reset to default" puts back (MP-00001).
export async function getCodeScheme() {
  const { codeScheme } = await readSetting({ codeScheme: true });
  const [{ sample }, lastChanged] = await Promise.all([previewScheme(codeScheme), lastChange()]);
  return {
    scheme: codeScheme,
    format: sample,
    defaultScheme: DEFAULT_CODE_SCHEME,
    lastChanged,
  };
}

// PUT /api/admin/code-scheme: `scheme` is already checked by codeSchemeSchema in the route.
// A scheme that could make codes longer than 30 characters is refused (the scanner and the
// item page accept at most 30). The new scheme and its AuditLog entry are saved in one
// transaction. nextNumber is not touched: the running number keeps counting across schemes,
// so codes stay unique.
export async function saveCodeScheme(actorId, scheme) {
  if (await isOverLimit(scheme)) {
    throw codeTooLong();
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({
      where: { id: SETTINGS_ID },
      select: { codeScheme: true },
    });
    if (!before) {
      throw new AppError(500, 'SETTINGS_MISSING', 'Settings are missing. Run the seed.');
    }
    await tx.setting.update({ where: { id: SETTINGS_ID }, data: { codeScheme: scheme } });
    await logChange(tx, {
      actorId,
      entity: 'Setting',
      entityId: SETTINGS_ID,
      action: CODE_SCHEME_ACTION,
      before: before.codeScheme,
      after: scheme,
    });
  });
  return getCodeScheme();
}
