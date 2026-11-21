// "+ Add new" for the lists with a short code: categories, brands, colours and campuses.
// Rules (01 › Adding and editing items): names are unique within a list, ignoring upper and
// lower case; short codes are suggested but editable, and unique within their list.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { logChange } from './auditService.js';
import { suggest } from './shortCodeService.js';

export const LIST_NAMES = ['category', 'brand', 'colour', 'campus'];

const models = {
  category: prisma.category,
  brand: prisma.brand,
  colour: prisma.colour,
  campus: prisma.campus,
};

// Names used in the AuditLog.
const entities = { category: 'Category', brand: 'Brand', colour: 'Colour', campus: 'Campus' };

// The fields returned for a created entry (the same as in GET /api/lookups).
const fields = {
  category: { id: true, name: true, code: true, autoApprove: true },
  brand: { id: true, name: true, code: true },
  colour: { id: true, name: true, code: true },
  campus: { id: true, name: true, code: true },
};

// All codes of a list, archived ones included: a code stays taken after archiving.
async function takenCodes(list) {
  const rows = await models[list].findMany({ select: { code: true } });
  return rows.map((row) => row.code);
}

// GET /api/lookups/suggest-code: e.g. ("brand", "Isku") → "ISK", or "ISK2" if ISK is taken.
export async function suggestCode(list, name) {
  return suggest(name, await takenCodes(list));
}

// The entry that blocks a new name or short code, as an error with the pop-up text (P1–P4):
// "Chair already exists" (with the existing entry for the "Use Chair" button) or
// "CHR is already used by Chair". Returns null when nothing blocks.
async function findDuplicate(list, name, code) {
  const model = models[list];

  const sameName = await model.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: fields[list],
  });
  if (sameName) {
    return new AppError(409, 'DUPLICATE_NAME', `${sameName.name} already exists`, {
      existing: sameName,
    });
  }

  if (code) {
    const sameCode = await model.findUnique({ where: { code }, select: { name: true } });
    if (sameCode) {
      return new AppError(409, 'DUPLICATE_CODE', `${code} is already used by ${sameCode.name}`);
    }
  }
  return null;
}

// Creates one entry. `data` is already validated: { name, code?, autoApprove? }.
// Without a code, the suggestion is used. `actorId` is the logged-in moderator or admin.
export async function createEntry(list, { name, code, ...extra }, actorId) {
  const duplicate = await findDuplicate(list, name, code);
  if (duplicate) {
    throw duplicate;
  }

  const finalCode = code ?? (await suggestCode(list, name));
  if (!finalCode) {
    throw new AppError(400, 'CODE_REQUIRED', 'Enter a short code.');
  }

  try {
    // The entry and its AuditLog row are saved together. tx[list] is e.g. tx.category.
    return await prisma.$transaction(async (tx) => {
      const entry = await tx[list].create({
        data: { name, code: finalCode, ...extra },
        select: fields[list],
      });
      await logChange(tx, {
        actorId,
        entity: entities[list],
        entityId: entry.id,
        action: 'create',
        after: entry,
      });
      return entry;
    });
  } catch (err) {
    // Someone saved the same name or code at the same moment and the database blocked it:
    // look again, so the pop-up still gets the right message.
    if (err.code === 'P2002') {
      throw (await findDuplicate(list, name, finalCode)) ?? err;
    }
    throw err;
  }
}
