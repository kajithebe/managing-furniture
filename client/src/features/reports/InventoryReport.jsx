import { useEffect, useMemo, useState } from 'react';
import { getLookups } from '../../api/lookups.js';
import { getInventoryReport } from '../../api/reports.js';
import Badge from '../../components/ui/Badge.jsx';
import Select from '../../components/ui/Select.jsx';
import Table from '../../components/ui/Table.jsx';
import Pagination from './Pagination.jsx';
import ReportsHeader from './ReportsHeader.jsx';

// M9 Reports › Inventory: filters, a sortable table of all items and paging (25 per page).
const PAGE_SIZE = 25;
const NO_FILTERS = { campus: '', building: '', room: '', category: '', status: '' };

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

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// The M9 columns. `key` is also the sort column of the API (02 › GET /items, sort=).
const COLUMNS = [
  { key: 'code', label: 'Code', render: (item) => <span className="font-mono">{item.code}</span> },
  { key: 'category', label: 'Category', render: (item) => item.category.name },
  { key: 'name', label: 'Name', render: (item) => item.name },
  { key: 'brand', label: 'Brand', render: (item) => item.brand?.name },
  { key: 'colour', label: 'Colour', render: (item) => item.colour?.name },
  { key: 'wheels', label: 'Wheels', render: (item) => (item.hasWheels ? item.wheelCount : 'No') },
  { key: 'homeRoom', label: 'Home room', render: (item) => item.homeRoom.name },
  { key: 'currentRoom', label: 'Current room', render: (item) => item.currentRoom.name },
  { key: 'status', label: 'Status', render: (item) => <Badge status={BADGES[item.status]} /> },
];

function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

// Column header with the sort arrow: ↕ not sorted, ↑ A–Z, ↓ Z–A.
function SortButton({ column, sort, onSort }) {
  const active = sort.column === column.key;
  const arrow = active ? (sort.order === 'asc' ? '↑' : '↓') : '↕';
  const state = active ? (sort.order === 'asc' ? ', sorted A to Z' : ', sorted Z to A') : '';

  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      aria-label={`Sort by ${column.label}${state}`}
      className={`inline-flex items-center gap-1 rounded ${focusRing} ${active ? 'text-ink' : ''}`}
    >
      {column.label}
      <span aria-hidden="true">{arrow}</span>
    </button>
  );
}

export default function InventoryReport() {
  const [lookups, setLookups] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ column: 'code', order: 'asc' });
  const [page, setPage] = useState(1);
  // The last answer from the API, together with the query it belongs to.
  const [result, setResult] = useState({ params: null, data: [], total: 0, error: '' });

  const params = useMemo(
    () => ({ ...filters, sort: sort.column, order: sort.order, page, pageSize: PAGE_SIZE }),
    [filters, sort, page],
  );
  // Loading until the answer for the current filters has arrived.
  const loading = result.params !== params;

  // Dropdown lists: campuses → buildings → rooms, and categories. Loaded once.
  useEffect(() => {
    const controller = new AbortController();
    getLookups({ signal: controller.signal })
      .then(setLookups)
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult((current) => ({ ...current, error: error.message }));
        }
      });
    return () => controller.abort();
  }, []);

  // The table: loaded again whenever a filter, the sort order or the page changes.
  // An older request is cancelled, so a slow answer can never replace a newer one.
  useEffect(() => {
    const controller = new AbortController();
    getInventoryReport(params, { signal: controller.signal })
      .then(({ data, total }) => setResult({ params, data, total, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, data: [], total: 0, error: error.message });
        }
      });
    return () => controller.abort();
  }, [params]);

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
      if (name === 'building') {
        next.room = '';
      }
      return next;
    });
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

  const filterFields = [
    { name: 'campus', label: 'Campus', options: toOptions(campuses) },
    { name: 'building', label: 'Building', options: toOptions(buildings) },
    { name: 'room', label: 'Room', options: toOptions(rooms) },
    { name: 'category', label: 'Category', options: toOptions(lookups?.categories ?? []) },
    { name: 'status', label: 'Status', options: STATUSES },
  ];

  const tableColumns = COLUMNS.map((column) => ({
    key: column.key,
    header: <SortButton column={column} sort={sort} onSort={changeSort} />,
    render: column.render,
  }));

  return (
    <>
      <ReportsHeader />

      <div className="mt-4 grid grid-cols-5 gap-4">
        {filterFields.map((field) => (
          <Select
            key={field.name}
            id={`inventory-${field.name}`}
            label={field.label}
            placeholder="All"
            options={field.options}
            value={filters[field.name]}
            onChange={(event) => changeFilter(field.name, event.target.value)}
          />
        ))}
      </div>

      {result.error && (
        <p role="alert" className="mt-4 rounded-card bg-warn-bg p-4 text-sm text-warn">
          ! {result.error}
        </p>
      )}

      <div aria-busy={loading} className={`mt-4 ${loading ? 'opacity-60' : ''}`}>
        <Table
          caption="Inventory"
          rowKey="code"
          columns={tableColumns}
          rows={result.data}
          emptyText={loading ? 'Loading…' : 'No items match these filters.'}
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
    </>
  );
}
