import { useId, useState } from 'react';
import Field from '../../components/ui/Field.jsx';

// S4 "Move to room *": type part of a room ("D7") and pick it from the list below.
// rooms: [{ id, label: "Karaportti · D · D751" }]; value: the chosen room id or null.
const MAX_SHOWN = 8;

export default function RoomPicker({ id, rooms, value, onChange, error }) {
  const listId = useId();
  const [query, setQuery] = useState(() => rooms.find((room) => room.id === value)?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const words = query
    .toLowerCase()
    .split(/[\s·]+/)
    .filter(Boolean);
  const matches = rooms
    .filter((room) => words.every((word) => room.label.toLowerCase().includes(word)))
    .slice(0, MAX_SHOWN);

  function choose(room) {
    onChange(room.id);
    setQuery(room.label);
    setOpen(false);
  }

  function handleChange(event) {
    setQuery(event.target.value);
    setActive(0);
    setOpen(true);
    onChange(null);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && query.trim() !== '' && value === null;

  return (
    <Field id={id} label="Move to room" required error={error}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Type a room, e.g. D751"
        autoComplete="off"
        className={`h-11 w-full rounded border bg-surface px-3 text-base text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${error ? 'border-danger' : 'border-line'}`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="mt-1 rounded-card border border-line bg-surface py-1"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-[15px] text-muted">No room matches “{query.trim()}”</li>
          ) : (
            matches.map((room, index) => (
              <li
                key={room.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // mousedown instead of click, so the input does not lose focus first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(room);
                }}
                className={`flex min-h-11 cursor-pointer items-center px-3 text-[15px] text-ink ${index === active ? 'bg-brand-tint' : ''}`}
              >
                {room.label}
              </li>
            ))
          )}
        </ul>
      )}
    </Field>
  );
}
