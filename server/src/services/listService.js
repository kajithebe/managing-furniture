// "+ Add new" for the lists with a short code: categories, brands, colours and campuses.
// Rules (01 › Adding and editing items): names are unique within a list, ignoring upper and
// lower case; short codes are suggested but editable, and unique within their list.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { suggest } from './shortCodeService.js';

export const LIST_NAMES = ['category', 'brand', 'colour', 'campus'];

const models = {
  category: prisma.category,
  brand: prisma.brand,
  colour: prisma.colour,
  campus: prisma.campus,
};

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

// Creates one entry. `data` is already validated: { name, code?, autoApprove? }.
// Without a code, the suggestion is used.
export async function createEntry(list, { name, code, ...extra }) {
  const model = models[list];

  const sameName = await model.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (sameName) {
    throw new AppError(409, 'DUPLICATE_NAME', `"${name}" already exists.`);
  }

  const finalCode = code ?? (await suggestCode(list, name));
  if (!finalCode) {
    throw new AppError(400, 'CODE_REQUIRED', 'Enter a short code.');
  }

  const sameCode = await model.findUnique({ where: { code: finalCode }, select: { id: true } });
  if (sameCode) {
    throw new AppError(409, 'DUPLICATE_CODE', `Short code ${finalCode} is already used.`);
  }

  try {
    return await model.create({
      data: { name, code: finalCode, ...extra },
      select: fields[list],
    });
  } catch (err) {
    // Two people saved the same name or code at the same moment: the database blocks it.
    if (err.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_NAME', 'This name or short code already exists.');
    }
    throw err;
  }
}
