// Asset codes (02 › Asset codes).
// A code is built from Setting.codeScheme and the global running number Setting.nextNumber.
// Rules: the running number counts across the whole system, a code is set once when the
// item is created and never changes, and numbers are reserved inside the same transaction
// as the item insert, so two moderators adding items at once never get the same number.
//
// Sprint 1 supports the default scheme (fixed text + running number, MP-00001).
// MF-21 (customizable code scheme) adds the campus, category, brand, colour and year segments.
import { AppError } from '../middleware/error.js';

const SETTINGS_ID = 1;

// Turns one running number into a code, e.g. 1 → "MP-00001".
export function buildCode(scheme, number) {
  const parts = scheme.segments.map((segment) => {
    switch (segment.type) {
      case 'text':
        return segment.value;
      case 'number':
        return String(number).padStart(scheme.numberLength, '0');
      default:
        // Only reachable if the scheme was changed before MF-21 adds the other segments.
        throw new AppError(
          500,
          'CODE_SCHEME_UNSUPPORTED',
          `Code scheme segment "${segment.type}" is not supported yet.`,
        );
    }
  });
  return parts.join(scheme.separator ?? '');
}

// Reserves `count` running numbers in one step and returns the new codes in order.
// Must be called with the transaction client (tx) of prisma.$transaction, so the numbers
// are only used up if the items are really saved.
export async function reserveCodes(tx, count) {
  // The atomic increment locks the settings row until the transaction ends,
  // so a second request waits instead of reading the same number.
  const setting = await tx.setting.update({
    where: { id: SETTINGS_ID },
    data: { nextNumber: { increment: count } },
    select: { nextNumber: true, codeScheme: true },
  });

  const firstNumber = setting.nextNumber - count;
  const codes = Array.from({ length: count }, (_, i) =>
    buildCode(setting.codeScheme, firstNumber + i),
  );

  // Safety net: a code must never be given twice (for example after a scheme change).
  const taken = await tx.item.findFirst({
    where: { code: { in: codes } },
    select: { code: true },
  });
  if (taken) {
    throw new AppError(409, 'CODE_TAKEN', `Asset code ${taken.code} already exists.`);
  }

  return codes;
}

// One code for one new item.
export async function nextCode(tx) {
  const [code] = await reserveCodes(tx, 1);
  return code;
}

// The codes the next `quantity` new items will get, for the preview on M6:
// "Next code: MP-00127" (quantity 1, first = last) or "Codes: MP-00127 – MP-00156".
// Read only: it does not use up numbers, so the real codes can differ if someone
// else saves an item first.
export async function previewCodes(db, quantity = 1) {
  const setting = await db.setting.findUnique({
    where: { id: SETTINGS_ID },
    select: { nextNumber: true, codeScheme: true },
  });
  if (!setting) {
    throw new AppError(500, 'SETTINGS_MISSING', 'Settings are missing. Run the seed.');
  }
  return {
    first: buildCode(setting.codeScheme, setting.nextNumber),
    last: buildCode(setting.codeScheme, setting.nextNumber + quantity - 1),
  };
}
