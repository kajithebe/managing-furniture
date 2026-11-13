import { useEffect, useRef, useState } from 'react';
import Field from './Field.jsx';

const ADD = '__add__';

export default function SelectWithAdd({
  id,
  label,
  hint,
  error,
  required = false,
  placeholder = 'Choose…',
  options = [],
  value = '',
  onChange,
  addLabel,
  onAddNew,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);

  const listId = `${id}-list`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  // Row 0 is always "+ Add new ...", the real options follow.
  const rows = [{ value: ADD, label: addLabel }, ...options];
  const selected = options.find((option) => option.value === value);

  // Close the list when the user clicks outside it.
  useEffect(() => {
    if (!open) return undefined;
    function handleMouseDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  function openList() {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index + 1 : 0);
    setOpen(true);
  }

  function choose(row) {
    setOpen(false);
    if (row.value === ADD) onAddNew?.();
    else onChange?.(row.value);
  }

  function handleKeyDown(event) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Escape') {
      // Close only the list, not a modal this select may sit in.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  const triggerClasses = [
    'flex h-11 w-full items-center justify-between gap-2 rounded border bg-surface px-3 text-left text-base',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
    error ? 'border-danger' : 'border-line',
    selected ? 'text-ink' : 'text-muted',
  ].join(' ');

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <div ref={rootRef} className="relative">
        <button
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          className={triggerClasses}
        >
          <span>{selected ? selected.label : placeholder}</span>
          <span aria-hidden="true" className="text-muted">
            ▾
          </span>
        </button>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded border border-line bg-surface"
          >
            {rows.map((row, index) => {
              const isAdd = row.value === ADD;
              const classes = [
                'flex min-h-11 cursor-pointer items-center px-3',
                isAdd ? 'border-b border-line text-sm font-semibold text-brand' : 'text-base text-ink',
                row.value === value ? 'bg-brand-tint' : index === active ? 'bg-page' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li
                  key={row.value}
                  id={`${id}-opt-${index}`}
                  role="option"
                  aria-selected={row.value === value}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(row)}
                  className={classes}
                >
                  {row.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Field>
  );
}