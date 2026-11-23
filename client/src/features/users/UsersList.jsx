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
import ChangeRoleDialog from './ChangeRoleDialog.jsx';
import DeactivateDialog from './DeactivateDialog.jsx';
import UserPanel from './UserPanel.jsx';
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
function columnsFor(currentUserId, onSelect) {
  return [
    {
      key: 'name',
      label: 'Name',
      // Clicking a name opens the A2 panel for that user (also the admin's own, locked row).
      render: (user) => (
        <button
          type="button"
          onClick={() => onSelect(user)}
          className={`rounded text-left text-ink hover:underline ${focusRing}`}
        >
          {user.name}
        </button>
      ),
    },
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

// Actions (A2): "Change role / Deactivate / View history" (or Reactivate). The admin's own
// row only has View history (02 › User safety rules).
function renderActions(
  user,
  currentUserId,
  { busyId, onChangeRole, onDeactivate, onReactivate, onViewHistory },
) {
  const viewHistory = <ActionLink onClick={() => onViewHistory(user)}>View history</ActionLink>;
  if (user.id === currentUserId) {
    return viewHistory;
  }
  const separator = <span className="text-muted"> / </span>;
  return (
    <span className="whitespace-nowrap">
      <ActionLink onClick={() => onChangeRole(user)}>Change role</ActionLink>
      {separator}
      {user.active ? (
        <ActionLink onClick={() => onDeactivate(user)}>Deactivate</ActionLink>
      ) : (
        <ActionLink disabled={busyId === user.id} onClick={() => onReactivate(user)}>
          Reactivate
        </ActionLink>
      )}
      {separator}
      {viewHistory}
    </span>
  );
}

// After React has drawn the panel: bring an element in it into view (and focus it if asked).
function showInPanel(elementId, focus = false) {
  setTimeout(() => {
    const element = document.getElementById(elementId);
    element?.scrollIntoView({ block: 'center' });
    if (focus) {
      element?.focus();
    }
  });
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
  // Counts saved changes (role, deactivate, reactivate); a new value loads the list again.
  const [changes, setChanges] = useState(0);
  // The user shown in the A2 panel under the table (by id, so a reload shows the new values).
  const [selectedId, setSelectedId] = useState(null);
  // "View history" shows the user's history in the panel.
  const [historyOpen, setHistoryOpen] = useState(false);
  // P15 is open for { user, newRole }.
  const [changingRole, setChangingRole] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [actionError, setActionError] = useState('');
  // The last answer from the API, together with the query and load it belongs to.
  const [result, setResult] = useState({
    params: null,
    loadKey: '',
    data: [],
    total: 0,
    activeAdmins: 0,
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
      .then(({ data, total, activeAdmins }) =>
        setResult({ params, loadKey, data, total, activeAdmins, failed: false }),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ params, loadKey, data: [], total: 0, activeAdmins: 0, failed: true });
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

  function selectUser(user, { history = false } = {}) {
    setActionError('');
    setSelectedId(user.id);
    setHistoryOpen(history);
  }

  // The panel shows the chosen user while they are on the current page.
  const selected = result.data.find((user) => user.id === selectedId) ?? null;

  function afterChange() {
    setChangingRole(null);
    setDeactivating(null);
    setChanges((current) => current + 1);
  }

  const tableColumns = [
    ...columnsFor(currentUser?.id, selectUser).map((column) => ({
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
          // Opens the panel and moves focus to its Role dropdown, which leads to P15.
          onChangeRole: (target) => {
            selectUser(target);
            showInPanel('user-panel-role', true);
          },
          onViewHistory: (target) => {
            selectUser(target, { history: true });
            showInPanel('user-history');
          },
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

      {selected && !loadFailed && (
        <UserPanel
          // A new user (or new values after a change) resets the Role dropdown.
          key={`${selected.id}-${selected.role}-${selected.active}`}
          user={selected}
          isSelf={selected.id === currentUser?.id}
          activeAdmins={result.activeAdmins}
          busy={reactivatingId === selected.id}
          showHistory={historyOpen}
          historyKey={changes}
          onRoleChange={(newRole) => setChangingRole({ user: selected, newRole })}
          onDeactivate={() => setDeactivating(selected)}
          onReactivate={() => reactivate(selected)}
        />
      )}

      {changingRole && (
        <ChangeRoleDialog
          user={changingRole.user}
          newRole={changingRole.newRole}
          onClose={() => setChangingRole(null)}
          onDone={afterChange}
        />
      )}

      {deactivating && (
        <DeactivateDialog
          user={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={afterChange}
        />
      )}
    </>
  );
}
