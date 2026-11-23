import { useEffect, useMemo, useState } from 'react';
import { getUsers, updateUser } from '../../api/users.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Select from '../../components/ui/Select.jsx';
import SortButton from '../../components/ui/SortButton.jsx';
import Table from '../../components/ui/Table.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import Pagination from '../reports/Pagination.jsx';
import { formatDateTime } from '../requests/format.js';
import DeactivateDialog from './DeactivateDialog.jsx';
import { ROLES, STATUSES, roleLabel } from './userText.js';

// A2 Users: search, Role and Status filters, a sortable table and paging (25 per page).
const PAGE_SIZE = 25;
// Wait this long after the last key press before searching, so typing a name is one request.
const SEARCH_DELAY_MS = 300;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// A text button in the Actions column ("Change role / Deactivate / View history").
function ActionLink({ children, ...rest }) {
  return (
    <button
      type="button"
      className={`rounded text-brand hover:underline disabled:text-muted ${focusRing}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// `key` is also the sort column of the API (GET /admin/users, sort=).
function columnsFor(currentUserId) {
  return [
    { key: 'name', label: 'Name', render: (user) => user.name },
    {
      key: 'email',
      label: 'Email',
      render: (user) => <span className="break-all">{user.email}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      // A2: the admin's own row cannot be changed.
      render: (user) =>
        user.id === currentUserId ? `${roleLabel(user.role)} (locked)` : roleLabel(user.role),
    },
    {
      key: 'status',
      label: 'Status',
      render: (user) =>
        user.active ? (
          <Badge status="available">• Active</Badge>
        ) : (
          <Badge status="returned">Deactivated</Badge>
        ),
    },
    {
      key: 'lastLogin',
      label: 'Last login',
      // A user added in advance has not logged in yet.
      render: (user) => (user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'),
    },
    { key: 'openLoans', label: 'Open loans', render: (user) => user.openLoans },
  ];
}

// Actions (A2): Deactivate for active users, Reactivate for deactivated ones. The admin's own
// row has no actions (02 › User safety rules). Change role and View history come next.
function renderActions(user, currentUserId, { busyId, onDeactivate, onReactivate }) {
  if (user.id === currentUserId) {
    return null;
  }
  return user.active ? (
    <ActionLink onClick={() => onDeactivate(user)}>Deactivate</ActionLink>
  ) : (
    <ActionLink disabled={busyId === user.id} onClick={() => onReactivate(user)}>
      Reactivate
    </ActionLink>
  );
}

// reloadKey: a new value loads the list again with the same filters (after Add user).
export default function UsersList({ reloadKey = 0 }) {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ column: 'name', order: 'asc' });
  const [page, setPage] = useState(1);
  // Counts "Try again" clicks; a new value loads the list again with the same filters.
  const [attempt, setAttempt] = useState(0);
  // Counts saved changes (deactivate, reactivate); a new value loads the list again.
  const [changes, setChanges] = useState(0);
  const [deactivating, setDeactivating] = useState(null);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [actionError, setActionError] = useState('');
  // The last answer from the API, together with the query and load it belongs to.
  const [result, setResult] = useState({
    params: null,
    loadKey: '',
    data: [],
    total: 0,
    failed: false,
  });

  // The search box updates the query only after a short pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const params = useMemo(
    () => ({ q, role, status, sort: sort.column, order: sort.order, page, pageSize: PAGE_SIZE }),
    [q, role, status, sort, page],
  );
  // A "Try again" click, a reload from the page or a saved change loads the same filters again.
  const loadKey = `${attempt}-${reloadKey}-${changes}`;
  // Loading until the answer for the current filters and the latest load has arrived.
  const loading = result.params !== params || result.loadKey !== loadKey;
  const loadFailed = !loading && result.failed;

  // An older request is cancelled, so a slow answer never replaces a newer one.
  useEffect(() => {
    const controller = new AbortController();
    getUsers(params, { signal: controller.signal })
      .then(({ data, total }) => setResult({ params, loadKey, data, total, failed: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, loadKey, data: [], total: 0, failed: true });
        }
      });
    return () => controller.abort();
  }, [params, loadKey]);

  function changeSort(column) {
    setSort((current) =>
      current.column === column
        ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { column, order: 'asc' },
    );
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setQ('');
    setRole('');
    setStatus('');
    setPage(1);
  }

  // Reactivate has no pop-up in the design: it is saved straight away.
  async function reactivate(user) {
    setReactivatingId(user.id);
    setActionError('');
    try {
      await updateUser(user.id, { active: true });
      setChanges((current) => current + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setReactivatingId(null);
    }
  }

  const tableColumns = [
    ...columnsFor(currentUser?.id).map((column) => ({
      key: column.key,
      header: <SortButton column={column} sort={sort} onSort={changeSort} />,
      render: column.render,
    })),
    {
      key: 'actions',
      header: 'Actions',
      render: (user) =>
        renderActions(user, currentUser?.id, {
          busyId: reactivatingId,
          onDeactivate: (target) => {
            setActionError('');
            setDeactivating(target);
          },
          onReactivate: reactivate,
        }),
    },
  ];

  const filtersChosen = Boolean(search.trim() || role || status);

  // Shared · Empty table: "No items match these filters" with Clear filters, worded for users.
  const emptyState = (
    <div className="py-6">
      <p className="text-base font-semibold text-ink">No users match these filters</p>
      {filtersChosen && (
        <Button variant="secondary" className="mt-4" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Input
          id="users-search"
          label="Name or email"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          id="users-role"
          label="Role"
          placeholder="All"
          options={ROLES}
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        />
        <Select
          id="users-status"
          label="Status"
          placeholder="All"
          options={STATUSES}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {actionError && (
        <p role="alert" className="mt-4 rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
          ! {actionError}
        </p>
      )}

      {loadFailed ? (
        <LoadError className="mt-4" onRetry={() => setAttempt((current) => current + 1)} />
      ) : (
        <div aria-busy={loading} className={`mt-4 ${loading ? 'opacity-60' : ''}`}>
          <Table
            caption="Users"
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

      {deactivating && (
        <DeactivateDialog
          user={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={() => {
            setDeactivating(null);
            setChanges((current) => current + 1);
          }}
        />
      )}
    </>
  );
}
