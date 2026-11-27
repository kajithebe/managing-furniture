// Code format builder helpers (A1 Settings › Asset codes, MF-21). Pure functions, no React.
// A segment is { type } or, for fixed text, { type: 'text', value }. Each type is used at most
// once (02 › Asset codes), so the type is also the segment's id (React key, drag id).

// Chip and button names from A1.
export const SEGMENT_LABELS = {
  text: 'Fixed text',
  campus: 'Campus code',
  category: 'Category code',
  brand: 'Brand code',
  colour: 'Colour code',
  year: 'Year added',
  number: 'Running number',
};

// The "Add a segment" buttons, in A1's order. No "+ Running number": the running number is
// always in the code exactly once (built differently from Figma, decided 26 Nov 2026).
export const ADDABLE_TYPES = ['text', 'campus', 'category', 'brand', 'colour', 'year'];

const FIXED_TEXT_PATTERN = /^[A-Z0-9][A-Z0-9/._-]{0,9}$/;

// The server's text for an invalid fixed text (codeService.js, 02 › Asset codes).
export const FIXED_TEXT_ERROR =
  'Fixed text must be 1–10 characters: A–Z, 0–9, / . _ -, starting with a letter or digit.';

// What the input keeps while typing: capitals, only the scanner's characters, at most 10.
export function cleanFixedText(input) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9/._-]/g, '')
    .slice(0, 10);
}

export function isFixedTextValid(value) {
  return FIXED_TEXT_PATTERN.test(value ?? '');
}

export function chipLabel(segment) {
  if (segment.type === 'text' && segment.value) {
    return `${SEGMENT_LABELS.text}: ${segment.value}`;
  }
  return SEGMENT_LABELS[segment.type];
}

export function hasSegment(segments, type) {
  return segments.some((segment) => segment.type === type);
}

// A new segment goes just before the running number, so the number stays at the end unless
// the admin moves it.
export function addSegment(segments, type) {
  if (hasSegment(segments, type)) return segments;
  const segment = type === 'text' ? { type, value: '' } : { type };
  const numberIndex = segments.findIndex((item) => item.type === 'number');
  const at = numberIndex === -1 ? segments.length : numberIndex;
  return [...segments.slice(0, at), segment, ...segments.slice(at)];
}

// The running number can never be removed.
export function removeSegment(segments, type) {
  if (type === 'number') return segments;
  return segments.filter((segment) => segment.type !== type);
}

// Moves a segment from one place to another (← → buttons and drag).
export function moveSegment(segments, from, to) {
  if (from === to || from < 0 || to < 0 || from >= segments.length || to >= segments.length) {
    return segments;
  }
  const next = [...segments];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setFixedText(segments, value) {
  return segments.map((segment) =>
    segment.type === 'text' ? { ...segment, value: cleanFixedText(value) } : segment,
  );
}
