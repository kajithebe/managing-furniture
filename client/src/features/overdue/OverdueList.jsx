import { useEffect, useMemo, useState } from 'react';
import { getLookups } from '../../api/lookups.js';
import { getOverdue } from '../../api/moderator.js';
import Button from '../../components/ui/Button.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Select from '../../components/ui/Select.jsx';
import SortButton from '../../components/ui/SortButton.jsx';
import Table from '../../components/ui/Table.jsx';
import { ItemName } from '../dashboard/DashboardPanel.jsx';
import { formatDayClock } from '../dashboard/format.js';
import Pagination from '../reports/Pagination.jsx';
import { formatContacted, formatLateBy, overdueMessage } from './overdueText.js';

// M4 Not yet returned: the yellow message, Category and Room filters, a sortable table and
// paging (25 per page). Rows come from GET /api/moderator/overdue (MF-23).
const PAGE_SIZE = 25;

// The item that is late the longest comes first, as on M1.
const DEFAULT_SORT = { column: 'lateBy', order: 'desc' };

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// A text button in the Actions column ("Email borrower / Mark returned").
function ActionLink({ children, ...rest }) {
  return (
    <button
      type="button"
      className={`rounded text-left text-brand hover:underline disabled:text-muted disabled:no-underline ${focusRing}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

// `key` is also the sort column of the API (GET /moderator/overdue, sort=).
function columnsFor(now) {
  return [
    { key: 'item', label: 'Item', render: (row) => <ItemName row={row} /> },
    {
      key: 'borrower',
      label: 'Borrower',
      // Name with the email under it; emails are shown only to moderators and admins (01).
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
    { key: 'lateBy', label: 'Late by', render: (row) => formatLateBy(row, now) },
    { key: 'lastRoom', label: 'Last known room', render: (row) => row.lastRoom.name },
    { key: 'homeRoom', label: 'Home room', render: (row) => row.homeRoom.name },
    {
      key: 'lastContacted',
      label: 'Last contacted',
      render: (row) => formatContacted(row.lastContactedAt, new Date(now)),
    },
  ];
}

export default function OverdueList() {
  const [filters, setFilters] = useState({ category: '', room: '' });
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  // Counts "Try again" clicks; a new value loads the list again with the same filters.
  const [attempt, setAttempt] = useState(0);
  const [lookups, setLookups] = useState(null);
  const [lookupsFailed, setLookupsFailed] = useState(false);
  // The last answer from the API, together with the query and load it belongs to.
  const [result, setResult] = useState({
    params: null,
    attempt: -1,
    data: [],
    total: 0,
    notYetReturned: 0,
    loadedAt: 0,
    failed: false,
  });

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
        if (error.name !== 'AbortError') setLookupsFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const params = useMemo(
    () => ({ ...filters, sort: sort.column, order: sort.order, page, pageSize: PAGE_SIZE }),
    [filters, sort, page],
  );
  // Loading until the answer for the current filters and the latest "Try again" has arrived.
  const loading = result.params !== params || result.attempt !== attempt;
  const loadFailed = !loading && (result.failed || lookupsFailed);

  // An older request is cancelled, so a slow answer never replaces a newer one.
  useEffect(() => {
    const controller = new AbortController();
    getOverdue(params, { signal: controller.signal })
      .then(({ data, total, notYetReturned }) =>
        setResult({
          params,
          attempt,
          data,
          total,
          notYetReturned,
          // "Late by" under an hour is counted to the moment the list was loaded.
          loadedAt: Date.now(),
          failed: false,
        }),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({
            params,
            attempt,
            data: [],
            total: 0,
            notYetReturned: 0,
            loadedAt: 0,
            failed: true,
          });
        }
      });
    return () => controller.abort();
  }, [params, attempt]);

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
    setFilters({ category: '', room: '' });
    setPage(1);
  }

  const rooms = (lookups?.campuses ?? [])
    .flatMap((campus) => campus.buildings)
    .flatMap((building) => building.rooms);

  const tableColumns = [
    ...columnsFor(result.loadedAt).map((column) => ({
      key: column.key,
      header: <SortButton column={column} sort={sort} onSort={changeSort} />,
      render: column.render,
    })),
    {
      key: 'actions',
      header: 'Actions',
      // TODO: Mark returned opens P12 in step 4b; Email borrower opens P11 when MF-20 is merged.
      render: () => (
        <span>
          <ActionLink disabled>Email borrower</ActionLink>
          <span className="text-muted"> / </span>
          <ActionLink disabled>Mark returned</ActionLink>
        </span>
      ),
    },
  ];

  const filtersChosen = Boolean(filters.category || filters.room);

  // Shared · Empty table: "No items match these filters." with Clear filters. Without filters
  // the list is empty because everything is back (same words as the M1 panel).
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

  return (
    <>
      {!loadFailed && result.notYetReturned > 0 && (
        <p role="status" className="mt-6 rounded-card bg-warn-bg px-4 py-3 text-sm text-warn">
          ! {overdueMessage(result.notYetReturned)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Select
          id="overdue-category"
          label="Category"
          placeholder="All"
          options={toOptions(lookups?.categories ?? [])}
          value={filters.category}
          onChange={(event) => changeFilter('category', event.target.value)}
        />
        <Select
          id="overdue-room"
          label="Room"
          placeholder="All"
          options={toOptions(rooms)}
          value={filters.room}
          onChange={(event) => changeFilter('room', event.target.value)}
        />
      </div>

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
