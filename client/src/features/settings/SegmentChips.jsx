import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

// One chip. Only the ⠿ handle starts a drag, so the buttons and the fixed text input work as
// usual. Keyboard: focus the handle, Space to pick up, ← → to move, Space to drop.
// panel: what shows under the chip's row (the fixed text input).
function SortableChip({ id, open, panel, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        'rounded border border-line px-2 py-1',
        open ? 'bg-brand-tint' : 'bg-surface',
        isDragging ? 'relative z-10 shadow-md' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="cursor-grab touch-none rounded px-1 text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand active:cursor-grabbing"
          aria-label={`Drag ${SEGMENT_LABELS[id]}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        {children}
      </div>
      {panel}
    </li>
  );
}

// A1 "Customize code format": the segment chips side by side, then "Add a segment".
// segments: the draft scheme's segments; onChange gets the new list.
export default function SegmentChips({ segments, onChange }) {
  // The fixed text chip opens with its input when it is added or its name is clicked.
  const [textOpen, setTextOpen] = useState(false);
  const [textTouched, setTextTouched] = useState(false);

  // A small move is needed before a drag starts, so a click on the handle is not a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const textSegment = segments.find((segment) => segment.type === 'text');
  const textValid = !textSegment || isFixedTextValid(textSegment.value);
  const ids = segments.map((segment) => segment.type);

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

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    onChange(moveSegment(segments, ids.indexOf(active.id), ids.indexOf(over.id)));
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ul className="mt-3 flex flex-wrap items-start gap-2" aria-label="Code segments">
            {segments.map((segment, index) => {
              const name = SEGMENT_LABELS[segment.type];
              const isText = segment.type === 'text';
              const open = isText && (textOpen || !textValid);
              return (
                <SortableChip
                  key={segment.type}
                  id={segment.type}
                  open={open}
                  panel={
                    open && (
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
                    )
                  }
                >
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
                </SortableChip>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
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
