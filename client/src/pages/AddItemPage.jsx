import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createItems } from '../api/items.js';
import { getLookups } from '../api/lookups.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Checkbox from '../components/ui/Checkbox.jsx';
import Input from '../components/ui/Input.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import SelectWithAdd from '../components/ui/SelectWithAdd.jsx';
import Toast from '../components/ui/Toast.jsx';
import AddEntryDialog from '../features/items/AddEntryDialog.jsx';
import NextCodePreview from '../features/items/NextCodePreview.jsx';
import RoomFields from '../features/items/RoomFields.jsx';
import { addToLookups, roomValueWith } from '../features/items/lookupsUpdate.js';
import {
  CONDITIONS,
  EMPTY_FORM,
  MAX_QUANTITY,
  toCreateBody,
  validateItem,
  validQuantity,
} from '../features/items/itemForm.js';

// M6 Add item (moderators and admins): one item, or up to 200 identical items with
// consecutive codes. After saving, "Items added" offers Print labels and Add more items.
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
const fieldClasses = `w-full rounded border border-line bg-surface px-3 text-base text-ink ${focusRing}`;

function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

// Toast text after "+ Add new": "Room D575 added".
const KIND_NAMES = {
  category: 'Category',
  brand: 'Brand',
  colour: 'Colour',
  campus: 'Campus',
  building: 'Building',
  room: 'Room',
};

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-brand">
      <Link to="/mod/items" className={focusRing}>
        Items
      </Link>{' '}
      / Add item
    </nav>
  );
}

// M6 "Added successfully": "30 items added: MP-00127 – MP-00156".
function ItemsAdded({ items, onAddMore }) {
  const navigate = useNavigate();
  const first = items[0].code;
  const last = items[items.length - 1].code;
  const codes = items.map((item) => item.code).join(',');

  return (
    <>
      <Breadcrumb />
      <h1 className="mt-4 text-[28px] font-semibold text-ink">Items added</h1>
      <Card className="mt-6">
        <p aria-hidden="true" className="text-[32px] leading-none text-brand">
          ✓
        </p>
        <p role="status" className="mt-4 text-[20px] font-semibold text-ink">
          {items.length} {items.length === 1 ? 'item' : 'items'} added:{' '}
          <span className="font-mono font-normal">
            {first}
            {items.length > 1 && ` – ${last}`}
          </span>
        </p>
        <div className="mt-4 flex gap-3">
          <Button
            onClick={() => navigate(`/mod/labels?type=items&codes=${encodeURIComponent(codes)}`)}
          >
            Print labels
          </Button>
          <Button variant="secondary" onClick={onAddMore}>
            Add more items
          </Button>
        </div>
      </Card>
    </>
  );
}

export default function AddItemPage() {
  const navigate = useNavigate();
  const [lookups, setLookups] = useState(null);
  const [lookupsFailed, setLookupsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  // Errors are shown for a field once the user has left it, not while typing the first time.
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [created, setCreated] = useState(null);
  // The open "+ Add new" pop-up: { kind, field, parent } or null. field is the form field
  // that gets the new entry: categoryId, brandId, colourId, homeRoom or currentRoom.
  const [adding, setAdding] = useState(null);
  const [toast, setToast] = useState('');
  // Goes up after every save, so the code preview loads the next free codes again.
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getLookups({ signal: controller.signal })
      .then((data) => {
        setLookups(data);
        setLookupsFailed(false);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLookupsFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const errors = validateItem(form);
  const valid = Object.keys(errors).length === 0;
  const quantity = validQuantity(form.quantity) ?? 1;
  const shown = (field) => (touched[field] ? errors[field] : undefined);
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));
  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  // Opens P1–P6. Building and room pop-ups show where the entry is added (P5, P6).
  function openAdd(kind, field) {
    let parent = null;
    if (kind === 'building' || kind === 'room') {
      const value = form[field];
      const campus = lookups.campuses.find((entry) => String(entry.id) === value.campus);
      const building = campus?.buildings.find((entry) => String(entry.id) === value.building);
      parent =
        kind === 'building'
          ? { id: campus.id, text: `Campus: ${campus.name}` }
          : { id: building.id, text: `${campus.name} · Building ${building.name}` };
    }
    setAdding({ kind, field, parent });
  }

  // The new (or existing, "Use Chair") entry is added to the lists and selected.
  // All other form values stay as they were.
  function selectEntry(entry, isNew) {
    const { kind, field } = adding;
    setLookups((current) => addToLookups(current, kind, entry));
    setForm((current) => ({
      ...current,
      // homeRoom and currentRoom hold { campus, building, room }, the others one id.
      [field]:
        typeof current[field] === 'object'
          ? roomValueWith(current[field], kind, entry)
          : String(entry.id),
    }));
    if (isNew) setToast(`${KIND_NAMES[kind]} ${entry.name} added`);
    setAdding(null);
  }

  async function save(event) {
    event.preventDefault();
    // React passes events from a portal up to its parents, so a submit inside the
    // "+ Add new" pop-up (Modal) also arrives here. Only this form's own submit saves.
    if (event.target !== event.currentTarget) return;
    if (!valid || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      setCreated(await createItems(toCreateBody(form)));
      setSaveCount((current) => current + 1);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function addMore() {
    setForm(EMPTY_FORM);
    setTouched({});
    setCreated(null);
  }

  if (created) return <ItemsAdded items={created} onAddMore={addMore} />;

  if (lookupsFailed) {
    return (
      <>
        <Breadcrumb />
        <h1 className="mt-4 text-[28px] font-semibold text-ink">Add item</h1>
        <LoadError
          className="mt-6"
          message="Couldn't load the lists for this form. Try again."
          text="Your entries are kept."
          onRetry={() => setAttempt((current) => current + 1)}
        />
      </>
    );
  }

  const campuses = lookups?.campuses ?? [];
  const category = lookups?.categories.find((entry) => String(entry.id) === form.categoryId);
  const roomsIncomplete = !form.homeRoom.room || !form.currentRoom.room;

  return (
    <form onSubmit={save} noValidate aria-busy={!lookups}>
      <Breadcrumb />
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink">Add item</h1>
        <NextCodePreview
          quantity={quantity}
          categoryId={form.categoryId}
          homeRoomId={form.homeRoom.room}
          brandId={form.brandId}
          colourId={form.colourId}
          version={saveCount}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 items-start gap-6">
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-ink">Item details</h2>
          {/* onBlur on the wrapper: SelectWithAdd has no onBlur of its own. */}
          <div onBlur={touch('categoryId')}>
            <SelectWithAdd
              id="item-category"
              label="Category"
              required
              placeholder=""
              options={toOptions(lookups?.categories ?? [])}
              value={form.categoryId}
              error={shown('categoryId')}
              addLabel="+ Add new category"
              onAddNew={() => openAdd('category', 'categoryId')}
              onChange={(value) => change('categoryId', value)}
            />
          </div>
          <Input
            id="item-name"
            label="Name / model"
            hint="Leave empty to use the category name"
            placeholder={category?.name ?? ''}
            maxLength={100}
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectWithAdd
              id="item-brand"
              label="Brand"
              placeholder=""
              options={toOptions(lookups?.brands ?? [])}
              value={form.brandId}
              addLabel="+ Add new brand"
              onAddNew={() => openAdd('brand', 'brandId')}
              onChange={(value) => change('brandId', value)}
            />
            <SelectWithAdd
              id="item-colour"
              label="Colour"
              placeholder=""
              options={toOptions(lookups?.colours ?? [])}
              value={form.colourId}
              addLabel="+ Add new colour"
              onAddNew={() => openAdd('colour', 'colourId')}
              onChange={(value) => change('colourId', value)}
            />
          </div>
          <Checkbox
            id="item-has-wheels"
            label="Has wheels"
            checked={form.hasWheels}
            onChange={(event) => change('hasWheels', event.target.checked)}
          >
            {form.hasWheels && (
              <Input
                id="item-wheel-count"
                label="Number of wheels"
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                hint="1–12"
                value={form.wheelCount}
                error={shown('wheelCount')}
                onChange={(event) => change('wheelCount', event.target.value)}
                onBlur={touch('wheelCount')}
              />
            )}
          </Checkbox>
          {roomsIncomplete && (
            <p className="text-xs text-muted">
              Building is enabled after choosing a campus. Room is enabled after choosing a
              building.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <RoomFields
            id="item-home"
            legend="Home room"
            campuses={campuses}
            value={form.homeRoom}
            onChange={(value) => change('homeRoom', value)}
            onAddNew={(kind) => openAdd(kind, 'homeRoom')}
          />
          <div>
            <RoomFields
              id="item-current"
              legend="Current room"
              campuses={campuses}
              value={form.currentRoom}
              onChange={(value) => change('currentRoom', value)}
              onAddNew={(kind) => openAdd(kind, 'currentRoom')}
            />
            <button
              type="button"
              onClick={() => change('currentRoom', form.homeRoom)}
              className={`mt-1 min-h-11 rounded text-[13px] text-brand hover:underline ${focusRing}`}
            >
              Same as home room
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="item-status" className="text-sm font-semibold text-ink">
              Status *
            </label>
            <select
              id="item-status"
              value={form.condition}
              onChange={(event) => change('condition', event.target.value)}
              className={`h-11 ${fieldClasses}`}
            >
              {CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="item-quantity"
            label="Quantity"
            required
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            hint={
              shown('quantity')
                ? undefined
                : 'Creates this many identical items with consecutive codes.'
            }
            value={form.quantity}
            error={shown('quantity')}
            onChange={(event) => change('quantity', event.target.value)}
            onBlur={touch('quantity')}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="item-notes" className="text-sm font-semibold text-ink">
              Notes
            </label>
            <textarea
              id="item-notes"
              rows={3}
              maxLength={1000}
              value={form.notes}
              onChange={(event) => change('notes', event.target.value)}
              className={`py-2 ${fieldClasses}`}
            />
          </div>

          {saveError && (
            <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
              ! {saveError}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={!valid || saving}>
              {saving ? 'Saving…' : quantity > 1 ? `Save ${quantity} items` : 'Save item'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/mod/items')}>
              Cancel
            </Button>
          </div>
          <Toast message={toast} onDismiss={() => setToast('')} />
        </Card>
      </div>

      {adding && (
        <AddEntryDialog
          kind={adding.kind}
          parent={adding.parent}
          onAdded={(entry) => selectEntry(entry, true)}
          onUse={(entry) => selectEntry(entry, false)}
          onClose={() => setAdding(null)}
        />
      )}
    </form>
  );
}
