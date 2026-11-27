import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import {
  ADDABLE_TYPES,
  FIXED_TEXT_ERROR,
  SEGMENT_LABELS,
  addSegment,
  chipLabel,
  hasSegment,
  isFixedTextValid,
  moveSegment,
  removeSegment,
  setFixedText,
} from './codeSegments.js';

const ICON_BUTTON =
  'flex h-7 w-7 items-center justify-center rounded text-brand enabled:hover:bg-page ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ' +
  'disabled:cursor-not-allowed disabled:text-line';

// A1 "Customize code format": the segment chips side by side, then "Add a segment".
// segments: the draft scheme's segments; onChange gets the new list.
export default function SegmentChips({ segments, onChange }) {
  // The fixed text chip opens with its input when it is added or its name is clicked.
  const [textOpen, setTextOpen] = useState(false);
  const [textTouched, setTextTouched] = useState(false);

  const textSegment = segments.find((segment) => segment.type === 'text');
  const textValid = !textSegment || isFixedTextValid(textSegment.value);

  function add(type) {
    onChange(addSegment(segments, type));
    if (type === 'text') {
      setTextOpen(true);
      setTextTouched(false);
    }
  }

  function remove(type) {
    onChange(removeSegment(segments, type));
    if (type === 'text') setTextOpen(false);
  }

  // The input stays open while the text is not valid, so a wrong text is never hidden.
  function toggleText() {
    if (textOpen && !textValid) {
      setTextTouched(true);
      return;
    }
    setTextOpen(!textOpen);
  }

  return (
    <>
      <ul className="mt-3 flex flex-wrap items-start gap-2" aria-label="Code segments">
        {segments.map((segment, index) => {
          const name = SEGMENT_LABELS[segment.type];
          const isText = segment.type === 'text';
          const open = isText && (textOpen || !textValid);
          return (
            <li
              key={segment.type}
              className={[
                'rounded border border-line px-2 py-1',
                open ? 'bg-brand-tint' : 'bg-surface',
              ].join(' ')}
            >
              <div className="flex items-center gap-1">
                <span className="px-1 text-muted" aria-hidden="true">
                  ⠿
                </span>
                {isText ? (
                  <button
                    type="button"
                    className="rounded px-1 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    aria-expanded={open}
                    onClick={toggleText}
                  >
                    {open ? name : chipLabel(segment)}
                  </button>
                ) : (
                  <span className="px-1 text-sm font-semibold text-ink">{name}</span>
                )}
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Move ${name} left`}
                  disabled={index === 0}
                  onClick={() => onChange(moveSegment(segments, index, index - 1))}
                >
                  ←
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Move ${name} right`}
                  disabled={index === segments.length - 1}
                  onClick={() => onChange(moveSegment(segments, index, index + 1))}
                >
                  →
                </button>
                {segment.type !== 'number' && (
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label={`Remove ${name}`}
                    onClick={() => remove(segment.type)}
                  >
                    ×
                  </button>
                )}
              </div>
              {open && (
                <div className="mt-1 w-56 pb-1">
                  <Input
                    id="code-fixed-text"
                    label="Fixed text"
                    mono
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={10}
                    value={segment.value}
                    error={textTouched && !textValid ? FIXED_TEXT_ERROR : undefined}
                    onChange={(event) => onChange(setFixedText(segments, event.target.value))}
                    onBlur={() => setTextTouched(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        toggleText();
                      }
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Needed to keep every code unique</p>

      <h3 className="mt-4 text-sm font-semibold text-ink">Add a segment</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {ADDABLE_TYPES.map((type) => (
          <Button
            key={type}
            variant="secondary"
            disabled={hasSegment(segments, type)}
            onClick={() => add(type)}
          >
            + {SEGMENT_LABELS[type]}
          </Button>
        ))}
      </div>
    </>
  );
}
