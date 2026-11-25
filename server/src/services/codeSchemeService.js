// Settings → Asset codes (A1, MF-21): read and save the code scheme.
// A saved scheme is used only for items created afterwards; existing codes never change.
// Every save is written to the AuditLog, which also gives A1 its
// "Last changed by Sebastian Lindsten, 5 Nov 2026" line.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { logChange } from './auditService.js';
import { DEFAULT_CODE_SCHEME } from './codeService.js';

const SETTINGS_ID = 1;
export const CODE_SCHEME_ACTION = 'code_scheme_change';

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

// GET /api/admin/code-scheme → { scheme, defaultScheme, lastChanged }
// defaultScheme is what "Reset to default" puts back (MP-00001).
export async function getCodeScheme() {
  const setting = await prisma.setting.findUnique({
    where: { id: SETTINGS_ID },
    select: { codeScheme: true },
  });
  if (!setting) {
    throw new AppError(500, 'SETTINGS_MISSING', 'Settings are missing. Run the seed.');
  }
  return {
    scheme: setting.codeScheme,
    defaultScheme: DEFAULT_CODE_SCHEME,
    lastChanged: await lastChange(),
  };
}

// PUT /api/admin/code-scheme: `scheme` is already checked by codeSchemeSchema in the route.
// The new scheme and its AuditLog entry are saved in one transaction. nextNumber is not
// touched: the running number keeps counting across schemes, so codes stay unique.
export async function saveCodeScheme(actorId, scheme) {
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
