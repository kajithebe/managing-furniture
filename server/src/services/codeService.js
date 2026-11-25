// Asset codes (02 › Asset codes).
// A code is built from Setting.codeScheme and the global running number Setting.nextNumber.
// Rules: the running number counts across the whole system, a code is set once when the
// item is created and never changes, and numbers are reserved inside the same transaction
// as the item insert, so two moderators adding items at once never get the same number.
// A new scheme only changes the codes of items created afterwards.
import { z } from 'zod';
import { AppError } from '../middleware/error.js';

const SETTINGS_ID = 1;

// MP-00001: fixed text + 5-digit running number (seed and "Reset to default").
export const DEFAULT_CODE_SCHEME = {
  segments: [{ type: 'text', value: 'MP' }, { type: 'number' }],
  separator: '-',
  numberLength: 5,
};

// Segments whose value comes from the item: the short code of its campus (of the home room),
// category, brand and colour, and the year it was added.
const ITEM_SEGMENTS = ['campus', 'category', 'brand', 'colour', 'year'];

// The longest asset code. The phone scanner (useScanner.js) and the item, loan and label
// routes accept codes of at most 30 characters, so a code format may never make a longer code.
export const CODE_MAX_LENGTH = 30;

// Fixed text: the characters the scanner accepts in a typed code (A–Z, 0–9, / . _ -),
// starting with a letter or digit, 1–10 characters. "mp/26" is saved as "MP/26".
const textSegment = z.object({
  type: z.literal('text'),
  value: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9][A-Z0-9/._-]{0,9}$/,
      'Fixed text must be 1–10 characters: A–Z, 0–9, / . _ -, starting with a letter or digit.',
    ),
});

// z.object drops unknown fields, e.g. a "value" sent with a campus segment.
const itemOrNumberSegment = z.object({ type: z.enum([...ITEM_SEGMENTS, 'number']) });

// A scheme as sent by Settings → Asset codes (PUT and preview) and stored in Setting.codeScheme.
export const codeSchemeSchema = z
  .object({
    segments: z
      .array(z.union([textSegment, itemOrNumberSegment]))
      .min(1)
      .max(7),
    separator: z.enum(['-', '/', '']),
    numberLength: z.number().int().min(4).max(6),
  })
  .superRefine((scheme, ctx) => {
    const types = scheme.segments.map((segment) => segment.type);
    // The running number keeps every code unique ("Needed to keep every code unique").
    if (types.filter((type) => type === 'number').length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['segments'],
        message: 'The running number must be in the code exactly once.',
      });
    }
    if (new Set(types).size !== types.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['segments'],
        message: 'Each segment can be used only once.',
      });
    }
  });

// The year segment: the last two digits of the year the item is added, in the app's
// time zone (TZ), so an item added just after midnight on 1 January gets the new year.
export function yearPart(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { year: '2-digit', timeZone }).format(date);
}

// The longest code a scheme can make with today's short codes. `lengths` holds the longest
// short code in each list: { campus, category, brand, colour }. Brand and colour count fully,
// because an item with a brand and a colour gets both in its code.
export function longestCodeLength(scheme, lengths) {
  const sizes = scheme.segments.map((segment) => {
    switch (segment.type) {
      case 'text':
        return segment.value.length;
      case 'number':
        return scheme.numberLength;
      case 'year':
        return 2;
      default:
        return lengths[segment.type] ?? 0;
    }
  });
  const separators = (scheme.separator ?? '').length * (sizes.length - 1);
  return sizes.reduce((sum, size) => sum + size, 0) + separators;
}

// Turns one running number into a code, e.g. 1 → "MP-00001", or 124 with
// parts { campus: 'KAR', category: 'CHR' } → "KAR-CHR-00124".
// `parts` holds the item's short codes and year: { campus, category, brand, colour, year }.
// An item may have no brand or colour: then that segment is left out of the code.
export function buildCode(scheme, number, parts = {}) {
  const values = scheme.segments.map((segment) => {
    switch (segment.type) {
      case 'text':
        return segment.value;
      case 'number':
        return String(number).padStart(scheme.numberLength, '0');
      case 'brand':
      case 'colour':
        return parts[segment.type] || null;
      default:
        // Campus, category and year: every item has them, so a missing one is a bug.
        if (!parts[segment.type]) {
          throw new AppError(
            500,
            'CODE_PART_MISSING',
            `The ${segment.type} part of the asset code is missing.`,
          );
        }
        return parts[segment.type];
    }
  });
  return values.filter((value) => value !== null).join(scheme.separator ?? '');
}

// Reserves `count` running numbers in one step and returns the new codes in order.
// Must be called with the transaction client (tx) of prisma.$transaction, so the numbers
// are only used up if the items are really saved.
export async function reserveCodes(tx, count, parts = {}) {
  // The atomic increment locks the settings row until the transaction ends,
  // so a second request waits instead of reading the same number.
  const setting = await tx.setting.update({
    where: { id: SETTINGS_ID },
    data: { nextNumber: { increment: count } },
    select: { nextNumber: true, codeScheme: true },
  });

  const firstNumber = setting.nextNumber - count;
  const codes = Array.from({ length: count }, (_, i) =>
    buildCode(setting.codeScheme, firstNumber + i, parts),
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
export async function nextCode(tx, parts = {}) {
  const [code] = await reserveCodes(tx, 1, parts);
  return code;
}

// The codes the next `quantity` new items will get, for the preview on M6:
// "Next code: MP-00127" (quantity 1, first = last) or "Codes: MP-00127 – MP-00156".
// Read only: it does not use up numbers, so the real codes can differ if someone
// else saves an item first.
export async function previewCodes(db, quantity = 1, parts = {}) {
  const setting = await db.setting.findUnique({
    where: { id: SETTINGS_ID },
    select: { nextNumber: true, codeScheme: true },
  });
  if (!setting) {
    throw new AppError(500, 'SETTINGS_MISSING', 'Settings are missing. Run the seed.');
  }
  return {
    first: buildCode(setting.codeScheme, setting.nextNumber, parts),
    last: buildCode(setting.codeScheme, setting.nextNumber + quantity - 1, parts),
  };
}
