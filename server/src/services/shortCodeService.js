// Short codes for categories, brands, colours and campuses (02 › Short code suggestions).
// The "+ Add new" pop-ups show a suggested short code that the user can still change.
// Suggestion: first letter + the following consonants, up to 3 characters, upper case
// (Chair → CHR, Table → TBL, Isku → ISK, Grey → GRY). If the code is taken, a number
// is added: CHR2, CHR3 …

// Valid short codes: 2–5 characters, A–Z and 0–9, upper case.
export const SHORT_CODE_PATTERN = /^[A-Z0-9]{2,5}$/;

const MAX_LETTERS = 3;
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// "Työpöytä" → "TYOPOYTA": accents removed, only A–Z and 0–9 kept.
function cleanName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// The suggestion before checking whether it is taken, e.g. "Chair" → "CHR".
function baseCode(name) {
  const letters = cleanName(name);
  if (letters.length === 0) {
    return '';
  }

  let code = letters[0];
  for (const char of letters.slice(1)) {
    if (code.length === MAX_LETTERS) {
      break;
    }
    if (!VOWELS.has(char)) {
      code += char;
    }
  }

  // Names with too few consonants (e.g. "Aie") are filled up with the next letters,
  // because a short code needs at least 2 characters.
  if (code.length < 2) {
    code = letters.slice(0, 2);
  }
  return code;
}

// Suggests a free short code for `name`. `existingCodes` are the codes already used in the
// same list (for example all category codes). Returns '' if the name has no usable letters,
// so the user has to type a code.
export function suggest(name, existingCodes = []) {
  const base = baseCode(name);
  if (base.length < 2) {
    return '';
  }

  const taken = new Set(existingCodes.map((code) => code.toUpperCase()));
  if (!taken.has(base)) {
    return base;
  }

  // CHR is taken → CHR2, CHR3 … (stays within the 5-character limit).
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}${n}`;
    if (candidate.length <= 5 && !taken.has(candidate)) {
      return candidate;
    }
  }
  return '';
}
