// The only CSV writer in the app (02 › Security, CSV export). Every report download uses it.
// - UTF-8 with a BOM at the start, so Excel shows ä, ö and → correctly.
// - Semicolon between cells: Excel in Finnish settings uses ; because , is the decimal mark.
// - Formula injection guard: a text cell starting with = + - @ tab or carriage return gets a
//   leading ', so Excel shows it as text instead of running it as a formula.
// - Cells with the separator, quotes or line breaks are put in quotes (RFC 4180).
const BOM = '\uFEFF';
const SEPARATOR = ';';
const LINE_END = '\r\n';
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[";\r\n]/;

// One cell as safe CSV text.
// null and undefined become an empty cell. Numbers are written as they are: they cannot be
// formulas. Everything else is turned into text and guarded.
export function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  let text = String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  if (NEEDS_QUOTES.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// Builds a whole CSV file.
// columns: [{ header: 'Code', value: (row) => row.code }, …], in the order they are shown.
// rows: the data rows. Returns the file as text, starting with the BOM.
export function toCsv(columns, rows) {
  const lines = [columns.map((column) => csvCell(column.header)).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(column.value(row))).join(SEPARATOR));
  }
  return `${BOM}${lines.join(LINE_END)}${LINE_END}`;
}
