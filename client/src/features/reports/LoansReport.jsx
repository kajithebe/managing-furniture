import { useEffect, useMemo, useState } from 'react';
import { getLookups } from '../../api/lookups.js';
import { downloadLoansCsv, getLoansReport } from '../../api/reports.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Select from '../../components/ui/Select.jsx';
import Table from '../../components/ui/Table.jsx';
import { formatDayClock } from '../dashboard/format.js';
import LoansSummary from './LoansSummary.jsx';
import Pagination from './Pagination.jsx';
import ReportsHeader from './ReportsHeader.jsx';

// M9 Reports › Loans (MF-32): date range, Category, Room and Status filters, the summary
// numbers, and a table of the loans, newest first, 25 per page. Download CSV has all rows.
// Figma has no Loans tab, so it follows the other M9 tabs (decided in MF-32).
const PAGE_SIZE = 25;
const NO_FILTERS = { from: '', to: '', category: '', room: '', status: '' };

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
];

function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

const when = (value) =>
  value ? <span className="whitespace-nowrap">{formatDayClock(value)}</span> : '—';

// The Loans columns (01 › Reports): loan date, borrower, items, from → to, reason, due,
// returned at, late. The borrower's email is shown: this page is for moderators and admins.
const COLUMNS = [
  { key: 'createdAt', header: 'Loan date', render: (row) => when(row.createdAt) },
  {
    key: 'borrower',
    header: 'Borrower',
    render: (row) => (
      <>
        <span className="block">{row.borrower.name}</span>
        <span className="block break-all text-muted">{row.borrower.email}</span>
      </>
    ),
  },
  {
    key: 'items',
    header: 'Items',
    render: (row) => (
      <ul className="space-y-0.5">
        {row.items.map((item) => (
          <li key={item.id}>
            {item.name} <span className="whitespace-nowrap font-mono">{item.code}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: 'rooms',
    header: 'From → To',
    render: (row) =>
      `${row.fromRooms.map((room) => room.name).join(', ') || '—'} → ${row.toRoom?.name ?? '—'}`,
  },
  { key: 'reason', header: 'Reason' },
  { key: 'dueAt', header: 'Due', render: (row) => when(row.dueAt) },
  { key: 'returnedAt', header: 'Returned at', render: (row) => when(row.returnedAt) },
  {
    key: 'late',
    header: 'Late',
    render: (row) => (row.late ? <Badge status="overdue">Late</Badge> : '—'),
  },
];

export default function LoansReport() {
  const [lookups, setLookups] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
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
    summary: null,
    failed: false,
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // The end date may not be before the start date; the API would refuse it, so it is not sent.
  const dateError =
    filters.from && filters.to && filters.from > filters.to
      ? 'The end date must be on or after the start date.'
      : '';

  const params = useMemo(
    () => (dateError ? null : { ...filters, page, pageSize: PAGE_SIZE }),
    [filters, page, dateError],
  );
  const loading = params !== null && (result.params !== params || result.attempt !== attempt);
  const loadFailed = !loading && (result.failed || lookupsFailed);

  // Dropdown lists: categories, and every room of every campus and building.
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

  // The table and summary: loaded again whenever a filter or the page changes, and on
  // "Try again". An older request is cancelled, so a slow answer never replaces a newer one.
  useEffect(() => {
    if (!params) return undefined;
    const controller = new AbortController();
    getLoansReport(params, { signal: controller.signal })
      .then(({ data, total, summary }) =>
        setResult({ params, attempt, data, total, summary, failed: false }),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, attempt, data: [], total: 0, summary: null, failed: true });
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

  function clearFilters() {
    setFilters(NO_FILTERS);
    setPage(1);
  }

  // Download CSV: all loans for the current filters, not only this page.
  async function downloadCsv() {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadLoansCsv(params);
    } catch (error) {
      setDownloadError(error.message);
    } finally {
      setDownloading(false);
    }
  }

  const filtersChosen = Object.values(filters).some(Boolean);
  const emptyState = filtersChosen ? (
    <div className="py-6">
      <p className="text-base font-semibold text-ink">No loans match these filters.</p>
      <Button variant="secondary" className="mt-4" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  ) : (
    'No loans yet.'
  );

  return (
    <>
      <ReportsHeader
        action={
          <Button
            disabled={!params || loading || downloading || loadFailed || result.total === 0}
            onClick={downloadCsv}
          >
            {downloading ? 'Downloading…' : 'Download CSV'}
          </Button>
        }
      />

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Input
          id="loans-report-from"
          type="date"
          label="From"
          value={filters.from}
          onChange={(event) => changeFilter('from', event.target.value)}
        />
        <Input
          id="loans-report-to"
          type="date"
          label="To"
          value={filters.to}
          error={dateError}
          onChange={(event) => changeFilter('to', event.target.value)}
        />
        <Select
          id="loans-report-category"
          label="Category"
          placeholder="All"
          options={toOptions(lookups?.categories ?? [])}
          value={filters.category}
          onChange={(event) => changeFilter('category', event.target.value)}
        />
        <Select
          id="loans-report-room"
          label="Room"
          placeholder="All"
          options={toOptions(rooms)}
          value={filters.room}
          onChange={(event) => changeFilter('room', event.target.value)}
        />
        <Select
          id="loans-report-status"
          label="Status"
          placeholder="All"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => changeFilter('status', event.target.value)}
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
        params && (
          <div aria-busy={loading} className={loading ? 'opacity-60' : ''}>
            {result.summary && <LoansSummary summary={result.summary} />}
            <Table
              className="mt-4"
              caption="Loans"
              columns={COLUMNS}
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
        )
      )}
    </>
  );
}
