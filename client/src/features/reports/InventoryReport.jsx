import { useEffect, useMemo, useState } from 'react';
import { getLookups } from '../../api/lookups.js';
import { downloadInventoryCsv, getInventoryReport } from '../../api/reports.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Select from '../../components/ui/Select.jsx';
import SortButton from '../../components/ui/SortButton.jsx';
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

export default function InventoryReport() {
  const [lookups, setLookups] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ column: 'code', order: 'asc' });
  const [page, setPage] = useState(1);
  // Counts "Try again" clicks; a new value loads the lists again with the same filters.
  const [attempt, setAttempt] = useState(0);
  const [lookupsFailed, setLookupsFailed] = useState(false);
  // The last answer from the API, together with the query and attempt it belongs to.
  const [result, setResult] = useState({
    params: null,
    attempt: 0,
    data: [],
    total: 0,
    failed: false,
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const params = useMemo(
    () => ({ ...filters, sort: sort.column, order: sort.order, page, pageSize: PAGE_SIZE }),
    [filters, sort, page],
  );
  // Loading until the answer for the current filters (and the latest "Try again") has arrived.
  const loading = result.params !== params || result.attempt !== attempt;
  const loadFailed = !loading && (result.failed || lookupsFailed);

  // Dropdown lists: campuses → buildings → rooms, and categories. Loaded again on "Try again".
  useEffect(() => {
    const controller = new AbortController();
    getLookups({ signal: controller.signal })
      .then((data) => {
        setLookups(data);
        setLookupsFailed(false);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLookupsFailed(true);
        }
      });
    return () => controller.abort();
  }, [attempt]);

  // The table: loaded again whenever a filter, the sort order or the page changes, and on
  // "Try again". An older request is cancelled, so a slow answer never replaces a newer one.
  useEffect(() => {
    const controller = new AbortController();
    getInventoryReport(params, { signal: controller.signal })
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

  function clearFilters() {
    setFilters(NO_FILTERS);
    setPage(1);
  }

  // Download CSV: all items for the current filters and sort order, not only this page.
  async function downloadCsv() {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadInventoryCsv(params);
    } catch (error) {
      setDownloadError(error.message);
    } finally {
      setDownloading(false);
    }
  }

  const filtersChosen = Object.values(filters).some(Boolean);

  // M9 empty report. The design text mentions a date range, which this tab does not have,
  // so the second line is reworded (03 › wording rule; needs team agreement).
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
      <ReportsHeader
        action={
          <Button
            disabled={loading || downloading || loadFailed || result.total === 0}
            onClick={downloadCsv}
          >
            {downloading ? 'Downloading…' : 'Download CSV'}
          </Button>
        }
      />

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

      {downloadError && (
        <p role="alert" className="mt-4 rounded-card bg-warn-bg p-4 text-sm text-warn">
          ! {downloadError}
        </p>
      )}

      {loadFailed ? (
        <LoadError className="mt-4" onRetry={() => setAttempt((current) => current + 1)} />
      ) : (
        <div aria-busy={loading} className={`mt-4 ${loading ? 'opacity-60' : ''}`}>
          <Table
            caption="Inventory"
            rowKey="code"
            columns={tableColumns}
            rows={result.data}
            emptyText={loading ? 'Loading…' : emptyState}
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
