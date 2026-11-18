import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../src/utils/csv.js';

describe('csvCell', () => {
  it('leaves normal text unchanged', () => {
    expect(csvCell('Chair')).toBe('Chair');
    expect(csvCell('MP-00123')).toBe('MP-00123');
  });

  it('writes an empty cell for null and undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('writes numbers as they are, also negative ones', () => {
    expect(csvCell(5)).toBe('5');
    expect(csvCell(-3)).toBe('-3');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'adds a leading quote to text starting with a formula character: %j',
    (value) => {
      expect(csvCell(value).replace(/^"/, '')).toMatch(/^'/);
    },
  );

  it('guards a real formula attack', () => {
    expect(csvCell('=HYPERLINK("http://evil.example","Click")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""Click"")"',
    );
  });

  it('puts cells with the separator, quotes or line breaks in quotes', () => {
    expect(csvCell('D569; D751')).toBe('"D569; D751"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('keeps commas without quotes, because the separator is a semicolon', () => {
    expect(csvCell('Grey, dark')).toBe('Grey, dark');
  });
});

describe('toCsv', () => {
  const columns = [
    { header: 'Code', value: (row) => row.code },
    { header: 'Colour', value: (row) => row.colour },
    { header: 'Wheels', value: (row) => row.wheels },
  ];

  it('starts with the UTF-8 BOM and ends every line with CRLF', () => {
    const csv = toCsv(columns, [{ code: 'MP-00123', colour: 'Grey', wheels: 5 }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFCode;Colour;Wheels\r\nMP-00123;Grey;5\r\n');
  });

  it('writes only the header row when there are no rows', () => {
    expect(toCsv(columns, [])).toBe('\uFEFFCode;Colour;Wheels\r\n');
  });

  it('keeps letters like ä and ö as they are', () => {
    const csv = toCsv(columns, [{ code: 'MP-00124', colour: 'Vaaleanharmaa ä ö', wheels: null }]);
    expect(csv).toContain('MP-00124;Vaaleanharmaa ä ö;\r\n');
  });

  it('guards every data cell against formulas', () => {
    const csv = toCsv(columns, [{ code: '=cmd', colour: '@x', wheels: null }]);
    expect(csv).toContain("'=cmd;'@x;\r\n");
  });
});
