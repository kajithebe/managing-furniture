import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadItemHistoryCsv, getItemHistoryReport } from '../../api/reports.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Table from '../../components/ui/Table.jsx';
import { formatDayClock } from '../dashboard/format.js';
import { eventLabel, roomMove } from './historyText.js';
import Pagination from './Pagination.jsx';
import ReportsHeader from './ReportsHeader.jsx';

// M9 Reports › Item history (MF-32): one item (asset code), a date range, or both; a table of
// the history events, newest first, 25 per page. Download CSV has all rows.
// Figma has no Item history tab, so it follows the other M9 tabs (decided in MF-32).
const PAGE_SIZE = 25;
const NO_FILTERS = { code: '', from: '', to: '' };

// How long to wait after the last key press before the typed code is searched.
const TYPING_DELAY_MS = 400;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// The Item history columns (01 › Reports: date, event, user, from → to room, note), with the
// item first, so a date range shows which item each event belongs to.
const COLUMNS = [
  {
    key: 'createdAt',
    header: 'Date',
    render: (row) => <span className="whitespace-nowrap">{formatDayClock(row.createdAt)}</span>,
  },
  {
    key: 'item',
    header: 'Item',
    render: (row) => (
      <Link
        to={`/mod/items/${encodeURIComponent(row.item.code)}`}
        className={`text-brand hover:underline ${focusRing}`}
      >
        {row.item.name} <span className="whitespace-nowrap font-mono">{row.item.code}</span>
      </Link>
    ),
  },
  { key: 'type', header: 'Event', render: eventLabel },
  // Events made by the system (e.g. "Not yet returned") have no user.
  { key: 'user', header: 'User', render: (row) => row.user?.name ?? '—' },
  { key: 'rooms', header: 'From → To', render: (row) => roomMove(row.fromRoom, row.toRoom) },
  { key: 'note', header: 'Note', render: (row) => row.note ?? '—' },
];

export default function ItemHistoryReport() {
  const [codeText, setCodeText] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  // Counts "Try again" clicks; a new value loads the list again with the same filters.
  const [attempt, setAttempt] = useState(0);
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

  // The typed code is searched a moment after the last key press, not on every letter.
  // Codes are stored in upper case, so "mp-00123" finds MP-00123.
  useEffect(() => {
    const code = codeText.trim().toUpperCase();
    if (code === filters.code) return undefined;
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, code }));
      setPage(1);
    }, TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [codeText, filters.code]);

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
  const loadFailed = !loading && result.failed;

  // The table: loaded again whenever a filter or the page changes, and on "Try again".
  // An older request is cancelled, so a slow answer never replaces a newer one.
  useEffect(() => {
    if (!params) return undefined;
    const controller = new AbortController();
    getItemHistoryReport(params, { signal: controller.signal })
      .then(({ data, total }) => setResult({ params, attempt, data, total, failed: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, attempt, data: [], total: 0, failed: true });
        }
      });
    return () => controller.abort();
  }, [params, attempt]);

  function changeDate(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function clearFilters() {
    setCodeText('');
    setFilters(NO_FILTERS);
    setPage(1);
  }

  // Download CSV: all events for the current item and dates, not only this page.
  async function downloadCsv() {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadItemHistoryCsv(params);
    } catch (error) {
      setDownloadError(error.message);
    } finally {
      setDownloading(false);
    }
  }

  const filtersChosen = Boolean(codeText.trim()) || Object.values(filters).some(Boolean);
  const emptyState = filtersChosen ? (
    <div className="py-6">
      <p className="text-base font-semibold text-ink">No history matches these filters.</p>
      <Button variant="secondary" className="mt-4" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  ) : (
    'Nothing has happened yet.'
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

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Input
          id="item-history-code"
          label="Asset code"
          hint="One item, e.g. MP-00123. Leave empty for all items."
          mono
          maxLength={30}
          value={codeText}
          onChange={(event) => setCodeText(event.target.value)}
        />
        <Input
          id="item-history-from"
          type="date"
          label="From"
          value={filters.from}
          onChange={(event) => changeDate('from', event.target.value)}
        />
        <Input
          id="item-history-to"
          type="date"
          label="To"
          value={filters.to}
          error={dateError}
          onChange={(event) => changeDate('to', event.target.value)}
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
          <div aria-busy={loading} className={`mt-4 ${loading ? 'opacity-60' : ''}`}>
            <Table
              caption="Item history"
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
