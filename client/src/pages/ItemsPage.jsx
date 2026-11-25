import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listItems } from '../api/items.js';
import { getLookups } from '../api/lookups.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import Select from '../components/ui/Select.jsx';
import SortButton from '../components/ui/SortButton.jsx';
import Table from '../components/ui/Table.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import Pagination from '../features/reports/Pagination.jsx';

// M5 Items (moderators and admins): search, filters, "Show disposed items", a sortable table
// and paging (25 per page). Selected rows open the Print labels page (M8).
const PAGE_SIZE = 25;
// The Labels page (M8) prints at most 200 labels at a time (02 › GET /labels/items).
const MAX_SELECTED = 200;
const SEARCH_DELAY_MS = 300;
const NO_FILTERS = { category: '', campus: '', building: '', room: '', status: '' };

// Shown statuses (02 › Item status shown in the app) with the badge for each (03).
const STATUSES = [
  { value: 'AVAILABLE', label: 'Available', badge: 'available' },
  { value: 'ON_LOAN', label: 'On loan', badge: 'onLoan' },
  { value: 'NEEDS_REPAIR', label: 'Needs repair', badge: 'needsRepair' },
  { value: 'BROKEN', label: 'Broken', badge: 'broken' },
  { value: 'IN_REPAIR', label: 'In repair', badge: 'inRepair' },
  { value: 'DISPOSED', label: 'Disposed', badge: 'disposed' },
];
const BADGES = Object.fromEntries(STATUSES.map((status) => [status.value, status.badge]));

// Starting filters from the address, e.g. a dashboard tile opens /mod/items?status=ON_LOAN
// or /mod/items?category=3. Same names and values as GET /api/items; unknown values are
// ignored, so a wrong link just opens the full list.
function filtersFromAddress(searchParams) {
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  return {
    ...NO_FILTERS,
    category: /^[1-9]\d{0,8}$/.test(category) ? category : '',
    status: STATUSES.some((entry) => entry.value === status) ? status : '',
  };
}

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// The M5 columns. `key` is also the sort column of the API (02 › GET /items, sort=).
const COLUMNS = [
  {
    key: 'code',
    label: 'Asset code',
    render: (item) => (
      <Link
        to={`/mod/items/${encodeURIComponent(item.code)}`}
        className={`rounded font-mono text-brand hover:underline ${focusRing}`}
      >
        {item.code}
      </Link>
    ),
  },
  { key: 'name', label: 'Name', render: (item) => item.name },
  { key: 'category', label: 'Category', render: (item) => item.category.name },
  { key: 'brand', label: 'Brand', render: (item) => item.brand?.name },
  { key: 'colour', label: 'Colour', render: (item) => item.colour?.name },
  { key: 'wheels', label: 'Wheels', render: (item) => (item.hasWheels ? item.wheelCount : 'No') },
  { key: 'homeRoom', label: 'Home room', render: (item) => item.homeRoom.name },
  { key: 'currentRoom', label: 'Now in', render: (item) => item.currentRoom.name },
  { key: 'status', label: 'Status', render: (item) => <Badge status={BADGES[item.status]} /> },
];

function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

// Row and "select all" checkbox: the 18 px box from 03 inside a 44 px tap area. The table has
// no room for a visible label, so the checkbox gets an aria-label instead.
function SelectBox({ label, checked, indeterminate = false, disabled = false, onChange }) {
  return (
    <label
      className={`-m-3 inline-flex h-11 w-11 items-center justify-center ${disabled ? '' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        // "Some rows on this page are selected": shown as a dash in the header box.
        ref={(element) => {
          if (element) element.indeterminate = indeterminate;
        }}
        onChange={(event) => onChange(event.target.checked)}
        className={`h-[18px] w-[18px] accent-brand disabled:cursor-not-allowed ${disabled ? '' : 'cursor-pointer'} ${focusRing}`}
      />
    </label>
  );
}

export default function ItemsPage() {
  const [lookups, setLookups] = useState(null);
  const [lookupsFailed, setLookupsFailed] = useState(false);
  // What is typed in the search box, and the text actually searched (after a short pause,
  // so the list is not loaded again on every key press).
  const [searchText, setSearchText] = useState('');
  const [q, setQ] = useState('');
  const [searchParams] = useSearchParams();
  // Read once when the page opens; after that the filters on the page decide.
  const [filters, setFilters] = useState(() => filtersFromAddress(searchParams));
  const [showDisposed, setShowDisposed] = useState(false);
  const [sort, setSort] = useState({ column: 'code', order: 'asc' });
  const [page, setPage] = useState(1);
  // Counts "Try again" clicks; a new value loads the lists again with the same filters.
  const [attempt, setAttempt] = useState(0);
  // The last answer from the API, together with the query and attempt it belongs to.
  const [result, setResult] = useState({ params: null, attempt: 0, data: [], total: 0 });
  // Codes of the selected rows. Kept when the page, filters or sort order change, so items
  // can be picked from several pages before printing.
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  const params = useMemo(
    () => ({
      q,
      ...filters,
      showDisposed,
      sort: sort.column,
      order: sort.order,
      page,
      pageSize: PAGE_SIZE,
    }),
    [q, filters, showDisposed, sort, page],
  );
  const loading = result.params !== params || result.attempt !== attempt;
  const loadFailed = !loading && (result.failed || lookupsFailed);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchText.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Dropdown lists: categories and campuses → buildings → rooms. Loaded again on "Try again".
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

  // The table. An older request is cancelled, so a slow answer never replaces a newer one.
  useEffect(() => {
    const controller = new AbortController();
    listItems(params, { signal: controller.signal })
      .then(({ data, total }) => setResult({ params, attempt, data, total, failed: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, attempt, data: [], total: 0, failed: true });
        }
      });
    return () => controller.abort();
  }, [params, attempt]);

  // Building and room lists follow the chosen campus and building; "All" shows every one.
  const campuses = lookups?.campuses ?? [];
  const buildings = campuses
    .filter((campus) => !filters.campus || String(campus.id) === filters.campus)
    .flatMap((campus) => campus.buildings);
  const rooms = buildings
    .filter((building) => !filters.building || String(building.id) === filters.building)
    .flatMap((building) => building.rooms);

  function changeFilter(name, value) {
    setFilters((current) => {
      const next = { ...current, [name]: value };
      // A new campus clears the building and room; a new building clears the room.
      if (name === 'campus') {
        next.building = '';
        next.room = '';
      }
      if (name === 'building') next.room = '';
      return next;
    });
    setPage(1);
  }

  function changeShowDisposed(value) {
    setShowDisposed(value);
    setPage(1);
  }

  function changeSort(column) {
    setSort((current) =>
      current.column === column
        ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { column, order: 'asc' },
    );
    setPage(1);
  }

  function clearFilters() {
    setSearchText('');
    setQ('');
    setFilters(NO_FILTERS);
    setShowDisposed(false);
    setPage(1);
  }

  // "Select all" works on the rows of the current page only.
  const pageCodes = result.data.map((item) => item.code);
  const pageSelected = pageCodes.filter((code) => selected.includes(code));
  const allOnPage = pageCodes.length > 0 && pageSelected.length === pageCodes.length;

  // The selection never goes past MAX_SELECTED: a row is only added while there is space,
  // and "select all" adds the rows of this page that still fit, in table order.
  const selectionFull = selected.length >= MAX_SELECTED;

  function selectRow(code, checked) {
    setSelected((current) => {
      if (!checked) return current.filter((value) => value !== code);
      return current.length < MAX_SELECTED ? [...current, code] : current;
    });
  }

  function selectPage(checked) {
    setSelected((current) => {
      if (!checked) return current.filter((code) => !pageCodes.includes(code));
      const space = MAX_SELECTED - current.length;
      const added = pageCodes.filter((code) => !current.includes(code)).slice(0, space);
      return [...current, ...added];
    });
  }

  // M8 reads the selection from the address (see LabelsPage.jsx).
  function printLabels() {
    navigate(`/mod/labels?type=items&codes=${encodeURIComponent(selected.join(','))}`);
  }

  const filtersChosen = Boolean(q) || showDisposed || Object.values(filters).some(Boolean);

  // Not in the design: same text as the Inventory report (needs team agreement).
  const emptyState = (
    <div className="py-6">
      <p className="text-base font-semibold text-ink">No items match these filters.</p>
      {filtersChosen && (
        <>
          <p className="mt-1 text-sm text-muted">Clear the filters to see more items.</p>
          <Button variant="secondary" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </>
      )}
    </div>
  );

  const filterFields = [
    { name: 'category', label: 'Category', options: toOptions(lookups?.categories ?? []) },
    { name: 'campus', label: 'Campus', options: toOptions(campuses) },
    { name: 'building', label: 'Building', options: toOptions(buildings) },
    { name: 'room', label: 'Room', options: toOptions(rooms) },
    { name: 'status', label: 'Status', options: STATUSES },
  ];

  const tableColumns = [
    {
      key: 'select',
      header: (
        <SelectBox
          label="Select all items on this page"
          checked={allOnPage}
          indeterminate={pageSelected.length > 0 && !allOnPage}
          onChange={selectPage}
        />
      ),
      render: (item) => (
        <SelectBox
          label={`Select ${item.code}`}
          checked={selected.includes(item.code)}
          // A full selection only lets rows be unticked.
          disabled={selectionFull && !selected.includes(item.code)}
          onChange={(checked) => selectRow(item.code, checked)}
        />
      ),
    },
    ...COLUMNS.map((column) => ({
      key: column.key,
      header: <SortButton column={column} sort={sort} onSort={changeSort} />,
      render: column.render,
    })),
  ];

  const linkButton = `rounded font-semibold text-brand hover:underline ${focusRing}`;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink">Items</h1>
        <Link
          to="/mod/items/new"
          className={`inline-flex h-11 items-center rounded bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-hover ${focusRing}`}
        >
          + Add item
        </Link>
      </div>

      <Input
        id="items-search"
        type="search"
        label="Search by code, name or brand"
        className="mt-1"
        value={searchText}
        maxLength={100}
        onChange={(event) => setSearchText(event.target.value)}
      />

      <div className="mt-4 grid grid-cols-5 gap-4">
        {filterFields.map((field) => (
          <Select
            key={field.name}
            id={`items-${field.name}`}
            label={field.label}
            placeholder="All"
            options={field.options}
            value={filters[field.name]}
            onChange={(event) => changeFilter(field.name, event.target.value)}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        <Toggle
          id="items-show-disposed"
          label="Show disposed items"
          checked={showDisposed}
          onChange={changeShowDisposed}
        />
        <button
          type="button"
          onClick={clearFilters}
          disabled={!filtersChosen}
          className={`h-11 rounded px-2 text-[15px] font-semibold text-brand disabled:text-muted ${focusRing}`}
        >
          Clear filters
        </button>
      </div>

      {selected.length > 0 && (
        <div
          role="status"
          className="mt-4 flex items-center gap-1 rounded-card bg-brand-tint px-4 py-3 text-sm text-ink"
        >
          <span aria-hidden="true" className="mr-1 font-semibold text-brand">
            i
          </span>
          {selected.length} selected ·
          <button type="button" onClick={printLabels} className={linkButton}>
            Print labels
          </button>
          ·
          <button type="button" onClick={() => setSelected([])} className={linkButton}>
            Clear selection
          </button>
          {selectionFull && (
            <span className="ml-1">· You can print up to {MAX_SELECTED} labels at a time.</span>
          )}
        </div>
      )}

      {loadFailed ? (
        <LoadError className="mt-4" onRetry={() => setAttempt((current) => current + 1)} />
      ) : (
        <div aria-busy={loading} className={`mt-4 ${loading ? 'opacity-60' : ''}`}>
          <Table
            caption="Items"
            rowKey="code"
            columns={tableColumns}
            rows={result.data}
            emptyText={loading ? 'Loading items…' : emptyState}
            footer={
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={result.total}
                onPageChange={setPage}
              />
            }
          />
        </div>
      )}
    </>
  );
}
