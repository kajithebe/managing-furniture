import Field from '../../components/ui/Field.jsx';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// A1 Separator choices: the value saved in the scheme and the text on the tab.
const SEPARATORS = [
  { value: '-', label: '-' },
  { value: '/', label: '/' },
  { value: '', label: 'none' },
];

const NUMBER_LENGTHS = [4, 5, 6];

// A1 "Separator" (- / none) and "Number length" (4, 5, 6) under the segment chips.
// separator, numberLength: the draft's values; onChange gets { separator } or { numberLength }.
export default function CodeFormatOptions({ separator, numberLength, onChange }) {
  return (
    <div className="mt-4 grid grid-cols-2 items-start gap-6">
      <div className="flex flex-col gap-1">
        <p id="code-separator-label" className="text-sm font-semibold text-ink">
          Separator
        </p>
        {/* One choice of three; each is its own button, so Tab reaches all of them. */}
        <div
          role="radiogroup"
          aria-labelledby="code-separator-label"
          className="flex border-b border-line"
        >
          {SEPARATORS.map((option) => {
            const selected = separator === option.value;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ separator: option.value })}
                className={`-mb-px h-11 border-b-2 px-4 text-[15px] ${focusRing} ${
                  selected
                    ? 'border-brand font-semibold text-brand'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field id="code-number-length" label="Number length" hint="4, 5, 6">
        <select
          id="code-number-length"
          aria-describedby="code-number-length-hint"
          value={numberLength}
          onChange={(event) => onChange({ numberLength: Number(event.target.value) })}
          className={`h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink ${focusRing}`}
        >
          {NUMBER_LENGTHS.map((length) => (
            <option key={length} value={length}>
              {length}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
