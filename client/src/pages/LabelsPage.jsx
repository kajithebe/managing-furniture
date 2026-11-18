// M8 "Print labels" (design-screens, desktop page 11). Moderators and admins.
// Opened with the selection in the address, so the Items list (MF-28) and room settings (MF-30)
// only need a link:
//   /mod/labels?type=items&codes=MP-00123,MP-00124
//   /mod/labels?type=rooms&ids=1,2
// Removing an entry with × updates the address, so a page reload keeps the selection.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getItemLabels, getRoomLabels } from '../api/labels.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import LabelSheets from '../features/labels/LabelSheets.jsx';

// Labels per sheet: the design shows 24 (item labels) and 12 (room labels).
// The second option of each list needs team agreement.
const TYPES = {
  items: {
    tab: 'Item labels',
    param: 'codes',
    heading: 'Selected items',
    perSheet: [24, 12],
    load: getItemLabels,
  },
  rooms: {
    tab: 'Room labels',
    param: 'ids',
    heading: 'Selected rooms',
    perSheet: [12, 4],
    load: getRoomLabels,
  },
};

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// "MP-00123,mp-00124,,MP-00123" → ['MP-00123', 'MP-00124']
function readCodes(value) {
  const codes = (value ?? '')
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(codes)];
}

// "1,2,abc" → [1, 2]
function readIds(value) {
  const ids = (value ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

// One row of the "Selected items" / "Selected rooms" list, with × to remove it.
function SelectedRow({ removeName, onRemove, children }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 text-[15px] text-ink">
      <span>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${removeName}`}
        className={`flex h-11 w-11 items-center justify-center rounded text-sm font-semibold text-brand hover:bg-page ${focusRing}`}
      >
        ×
      </button>
    </li>
  );
}

// M8: "Chair MP-00123" / "D569 · Karaportti · Building D"
function rowFromLabel(type, label) {
  if (type === 'items') {
    return {
      entry: label.code,
      removeName: label.code,
      text: (
        <>
          {label.name} <span className="font-mono">{label.code}</span>
        </>
      ),
    };
  }
  return {
    entry: label.id,
    removeName: label.name,
    text: `${label.name} · ${label.campus.name} · Building ${label.building.name}`,
  };
}

// When the server could not load the labels (e.g. an unknown code), the selection is still
// listed, so the moderator can remove the wrong entry.
function rowFromEntry(type, entry) {
  if (type === 'items') {
    return { entry, removeName: entry, text: <span className="font-mono">{entry}</span> };
  }
  return { entry, removeName: `room ${entry}`, text: `Room ${entry}` };
}

export default function LabelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const type = searchParams.get('type') === 'rooms' ? 'rooms' : 'items';
  const config = TYPES[type];
  const selected =
    type === 'items' ? readCodes(searchParams.get('codes')) : readIds(searchParams.get('ids'));
  // One text value for the effect below, so it only reloads when the selection really changes.
  const selectionKey = `${type}:${selected.join(',')}`;

  // Labels per sheet, remembered per label type while the page is open.
  const [perSheet, setPerSheet] = useState({ items: 24, rooms: 12 });

  // The last answer from the server and the selection it belongs to.
  // While the key differs from selectionKey, the page is loading.
  const [result, setResult] = useState({ key: null, labels: [], error: null });

  useEffect(() => {
    if (selected.length === 0) return undefined;

    const controller = new AbortController();
    config
      .load(selected, { signal: controller.signal })
      .then((body) => setResult({ key: selectionKey, labels: body.data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResult({ key: selectionKey, labels: [], error: error.message });
      });

    // Leaving the page or changing the selection cancels the old request.
    return () => controller.abort();
    // selectionKey already covers type and selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const isEmpty = selected.length === 0;
  const loading = !isEmpty && result.key !== selectionKey;
  const labels = isEmpty || loading ? [] : result.labels;
  const error = isEmpty || loading ? null : result.error;
  const rows = error
    ? selected.map((entry) => rowFromEntry(type, entry))
    : labels.map((label) => rowFromLabel(type, label));

  function showType(nextType) {
    const next = new URLSearchParams(searchParams);
    next.set('type', nextType);
    setSearchParams(next, { replace: true });
  }

  function removeEntry(entry) {
    const remaining = selected.filter((value) => value !== entry);
    const next = new URLSearchParams(searchParams);
    if (remaining.length > 0) {
      next.set(config.param, remaining.join(','));
    } else {
      next.delete(config.param);
    }
    setSearchParams(next, { replace: true });
  }

  // Back to the page the moderator came from; the Items list when the page was opened directly.
  function goBack() {
    if (location.key === 'default') {
      navigate('/mod/items');
    } else {
      navigate(-1);
    }
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-[13px] text-brand">
        <Link to="/mod/items" className={focusRing}>
          Items
        </Link>{' '}
        / Print labels
      </nav>
      <h1 className="mt-4 text-[28px] font-semibold text-ink">Print labels</h1>

      <div className="mt-6 grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-6">
        <Card>
          <p className="mb-3 text-xs text-muted">A4 · 210 × 297 mm</p>
          <LabelSheets type={type} labels={labels} perSheet={perSheet[type]} />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Options</h2>

          <p className="mt-4 text-sm font-semibold text-ink">Label type</p>
          <div role="tablist" aria-label="Label type" className="mt-2 flex border-b border-line">
            {Object.entries(TYPES).map(([key, { tab }]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={type === key}
                onClick={() => showType(key)}
                className={`-mb-px h-11 border-b-2 px-5 text-[15px] ${focusRing} ${
                  type === key
                    ? 'border-brand font-semibold text-brand'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor="labels-per-sheet" className="text-sm font-semibold text-ink">
              Labels per sheet
            </label>
            <select
              id="labels-per-sheet"
              value={perSheet[type]}
              onChange={(event) => setPerSheet({ ...perSheet, [type]: Number(event.target.value) })}
              className={`h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink ${focusRing}`}
            >
              {config.perSheet.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>

          <h3 className="mt-4 text-sm font-semibold text-ink">{config.heading}</h3>
          {isEmpty && (
            // Not in the design: needs team agreement.
            <p className="mt-2 text-sm text-muted">
              {type === 'items'
                ? 'No items selected. Select items in the Items list.'
                : 'No rooms selected. Select rooms in Settings › Locations.'}
            </p>
          )}
          {loading && <p className="mt-2 text-sm text-muted">Loading…</p>}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              ! {error}
            </p>
          )}
          {rows.length > 0 && (
            <ul className="mt-1">
              {rows.map(({ entry, removeName, text }) => (
                <SelectedRow
                  key={entry}
                  removeName={removeName}
                  onRemove={() => removeEntry(entry)}
                >
                  {text}
                </SelectedRow>
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-3">
            <Button onClick={() => window.print()} disabled={labels.length === 0}>
              Print
            </Button>
            <Button variant="secondary" onClick={goBack}>
              Back
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
