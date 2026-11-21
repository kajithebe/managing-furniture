// Six boxes for the 6-digit login code (S2). The parent holds the code as one string ("482913").
// Typing moves to the next box, Backspace goes back, and pasting or phone autofill
// ("one-time-code") fills all boxes at once.
import { useEffect, useRef } from 'react';

const LENGTH = 6;

export default function CodeInput({ value, onChange, labelledBy, invalid = false }) {
  const refs = useRef([]);
  // Box to focus after the parent has saved the new code. Focusing right away would run
  // handleFocus with the old (shorter) code and jump back to the first empty box.
  const pendingFocus = useRef(null);

  useEffect(() => {
    if (pendingFocus.current === null) return;
    refs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  }, [value]);

  function clamp(index) {
    return Math.max(0, Math.min(index, LENGTH - 1));
  }

  function focusBox(index) {
    refs.current[clamp(index)]?.focus();
  }

  // Put digits in from box `index` on, then focus the box after them once the new code is shown.
  function fillFrom(index, digits) {
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(
      0,
      LENGTH,
    );
    const target = clamp(index + digits.length);
    if (next === value) {
      // Same code (e.g. the same digit typed again): no re-render, so focus now.
      focusBox(target);
      return;
    }
    pendingFocus.current = target;
    onChange(next);
  }

  // Boxes are filled left to right: clicking an empty box further right goes to the first empty one.
  function handleFocus(index) {
    if (index > value.length) focusBox(value.length);
  }

  function handleChange(index, event) {
    let digits = event.target.value.replace(/\D/g, '');
    // Typing into a full box gives two characters: keep the new one.
    if (value[index] && digits.length === 2 && digits.startsWith(value[index])) {
      digits = digits.slice(1);
    }
    if (digits) fillFrom(index, digits);
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(Math.min(index + 1, value.length));
    }
  }

  function handlePaste(index, event) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!digits) return;
    event.preventDefault();
    fillFrom(digits.length === LENGTH ? 0 : index, digits);
  }

  return (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-6 gap-2">
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          aria-invalid={invalid ? 'true' : undefined}
          value={value[index] ?? ''}
          onFocus={() => handleFocus(index)}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          className={[
            'h-12 w-full rounded border bg-surface text-center font-mono text-xl text-ink',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            invalid ? 'border-danger' : 'border-line',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
