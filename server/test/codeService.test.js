// Asset code building and scheme checks (MF-21, 02 › Asset codes). No database needed.
import { describe, expect, it } from 'vitest';
import {
  buildCode,
  codeSchemeSchema,
  DEFAULT_CODE_SCHEME,
  yearPart,
} from '../src/services/codeService.js';

const PARTS = { campus: 'KAR', category: 'CHR', brand: 'ISK', colour: 'GRY', year: '26' };

function scheme(types, { separator = '-', numberLength = 5, text = 'MP' } = {}) {
  return {
    segments: types.map((type) => (type === 'text' ? { type, value: text } : { type })),
    separator,
    numberLength,
  };
}

describe('buildCode', () => {
  it('builds the default code MP-00001', () => {
    expect(buildCode(DEFAULT_CODE_SCHEME, 1)).toBe('MP-00001');
  });

  it('builds campus + category + number like the A1 preview', () => {
    expect(buildCode(scheme(['campus', 'category', 'number']), 124, PARTS)).toBe('KAR-CHR-00124');
  });

  it('builds every segment in the chosen order', () => {
    const all = scheme(['text', 'campus', 'category', 'brand', 'colour', 'number'], {
      text: 'METROPOLIA',
    });
    expect(buildCode(all, 1, PARTS)).toBe('METROPOLIA-KAR-CHR-ISK-GRY-00001');
  });

  it('uses the separator: / or none', () => {
    const types = ['campus', 'year', 'number'];
    expect(buildCode(scheme(types, { separator: '/' }), 7, PARTS)).toBe('KAR/26/00007');
    expect(buildCode(scheme(types, { separator: '' }), 7, PARTS)).toBe('KAR2600007');
  });

  it('pads the number to the number length (4–6)', () => {
    expect(buildCode(scheme(['number'], { numberLength: 4 }), 12)).toBe('0012');
    expect(buildCode(scheme(['number'], { numberLength: 6 }), 12)).toBe('000012');
  });

  it('leaves out brand and colour when the item has none', () => {
    const types = ['category', 'brand', 'colour', 'number'];
    expect(buildCode(scheme(types), 3, { category: 'TBL', brand: null })).toBe('TBL-00003');
  });

  it('fails when the campus or category is missing (a bug, not user input)', () => {
    expect(() => buildCode(scheme(['campus', 'number']), 1, {})).toThrow(
      expect.objectContaining({ code: 'CODE_PART_MISSING' }),
    );
  });
});

describe('yearPart', () => {
  it('uses the year in the app time zone', () => {
    // 31 Dec 2026 23:30 UTC is already 1 Jan 2027 in Helsinki.
    const date = new Date('2026-12-31T23:30:00Z');
    expect(yearPart(date, 'Europe/Helsinki')).toBe('27');
    expect(yearPart(date, 'UTC')).toBe('26');
  });
});

describe('codeSchemeSchema', () => {
  it('accepts the default scheme', () => {
    expect(codeSchemeSchema.parse(DEFAULT_CODE_SCHEME)).toEqual(DEFAULT_CODE_SCHEME);
  });

  it('saves fixed text in upper case and drops unknown fields', () => {
    const parsed = codeSchemeSchema.parse({
      segments: [
        { type: 'text', value: ' metropolia ' },
        { type: 'campus', value: 'x' },
        { type: 'number' },
      ],
      separator: '/',
      numberLength: 4,
      extra: true,
    });
    expect(parsed).toEqual({
      segments: [{ type: 'text', value: 'METROPOLIA' }, { type: 'campus' }, { type: 'number' }],
      separator: '/',
      numberLength: 4,
    });
  });

  it.each([
    ['no running number', scheme(['text', 'campus'])],
    ['two running numbers', scheme(['number', 'number'])],
    ['a segment twice', scheme(['campus', 'campus', 'number'])],
    ['an unknown segment', scheme(['room', 'number'])],
    ['a number length of 3', scheme(['number'], { numberLength: 3 })],
    ['a number length of 7', scheme(['number'], { numberLength: 7 })],
    ['another separator', scheme(['number'], { separator: '.' })],
    ['fixed text with a separator in it', scheme(['text', 'number'], { text: 'MP-1' })],
    ['empty fixed text', scheme(['text', 'number'], { text: ' ' })],
    ['fixed text over 10 characters', scheme(['text', 'number'], { text: 'METROPOLIA1' })],
  ])('refuses %s', (_, bad) => {
    expect(codeSchemeSchema.safeParse(bad).success).toBe(false);
  });
});
