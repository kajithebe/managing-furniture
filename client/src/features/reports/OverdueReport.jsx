import { useEffect, useMemo, useState } from 'react';
import { getLookups } from '../../api/lookups.js';
import { downloadOverdueCsv, getOverdueReport } from '../../api/reports.js';
import Button from '../../components/ui/Button.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Select from '../../components/ui/Select.jsx';
import SortButton from '../../components/ui/SortButton.jsx';
import Table from '../../components/ui/Table.jsx';
import { ItemName } from '../dashboard/DashboardPanel.jsx';
import { formatDayClock } from '../dashboard/format.js';
import { formatContacted } from '../overdue/overdueText.js';
import Pagination from './Pagination.jsx';
import ReportsHeader from './ReportsHeader.jsx';

// M9 Reports › Not yet returned (MF-23): Category and Room filters, a sortable table of the
// late items and paging (25 per page). The same rows as the Not yet returned page (M4),
// without the actions; Download CSV has all rows.
const PAGE_SIZE = 25;
const NO_FILTERS = { category: '', room: '' };

// The item that is late the longest comes first, as on M4.
const DEFAULT_SORT = { column: 'lateBy', order: 'desc' };

function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

// The M9 columns. `key` is also the sort column of the API (GET /reports/overdue, sort=).
function columnsFor(now) {
  return [
    { key: 'item', label: 'Item', render: (row) => <ItemName row={row} /> },
    {
      key: 'borrower',
      label: 'Borrower',
      // Name with the email under it; this page is for moderators and admins only.
      render: (row) => (
        <>
          <span className="block">{row.borrower.name}</span>
          <span className="block break-all">{row.borrower.email}</span>
        </>
      ),
    },
    {
      key: 'due',
      label: 'Due',
      render: (row) => <span className="whitespace-nowrap">{formatDayClock(row.dueAt)}</span>,
    },
    // M9 shows the number only ("26"); the same number as in the CSV.
    { key: 'lateBy', label: 'Hours late', render: (row) => row.hoursLate },
    { key: 'lastRoom', label: 'Last known room', render: (row) => row.lastRoom.name },
    { key: 'homeRoom', label: 'Home room', render: (row) => row.homeRoom.name },
    {
      key: 'lastContacted',
      label: 'Contacted',
      render: (row) => formatContacted(row.lastContactedAt, new Date(now)),
    },
  ];
}

export default function OverdueReport() {
  const [lookups, setLookups] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
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
    loadedAt: 0,
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

  // Dropdown lists: categories, and every room of every campus and building.
  // Loaded again on "Try again".
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
    getOverdueReport(params, { signal: controller.signal })
      .then(({ data, total }) =>
        setResult({ params, attempt, data, total, loadedAt: Date.now(), failed: false }),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, attempt, data: [], total: 0, loadedAt: 0, failed: true });
        }
      });
    return () => controller.abort();
  }, [params, attempt]);

  const rooms = (lookups?.campuses ?? [])
    .flatMap((campus) => campus.buildings)
    .flatMap((building) => building.rooms);

  function changeFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
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

  // Download CSV: all late items for the current filters and sort order, not only this page.
  async function downloadCsv() {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadOverdueCsv(params);
    } catch (error) {
      setDownloadError(error.message);
    } finally {
      setDownloading(false);
    }
  }

  const filtersChosen = Object.values(filters).some(Boolean);

  // Empty report: with filters, the Shared · Empty table text and Clear filters; without
  // filters nothing is late at all (same words as the Not yet returned page).
  const emptyState = filtersChosen ? (
    <div className="py-6">
      <p className="text-base font-semibold text-ink">No items match these filters.</p>
      <Button variant="secondary" className="mt-4" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  ) : (
    'Everything is back where it belongs.'
  );

  const tableColumns = columnsFor(result.loadedAt).map((column) => ({
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

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Select
          id="overdue-report-category"
          label="Category"
          placeholder="All"
          options={toOptions(lookups?.categories ?? [])}
          value={filters.category}
          onChange={(event) => changeFilter('category', event.target.value)}
        />
        <Select
          id="overdue-report-room"
          label="Room"
          placeholder="All"
          options={toOptions(rooms)}
          value={filters.room}
          onChange={(event) => changeFilter('room', event.target.value)}
        />
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
            caption="Not yet returned"
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
