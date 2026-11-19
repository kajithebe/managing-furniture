import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

// Menu from design-screens M1/M2 (moderator) and A2 (admin).
const MODERATOR_ITEMS = [
  { label: 'Dashboard', to: '/mod', exact: true },
  { label: 'Requests', to: '/mod/requests', countKey: 'waiting' },
  { label: 'Not yet returned', to: '/mod/overdue', countKey: 'notYetReturned' },
  // M8 Print labels belongs to Items ("Items / Print labels").
  { label: 'Items', to: '/mod/items', match: ['/mod/items', '/mod/labels'] },
  { label: 'Reports', to: '/mod/reports/inventory', match: '/mod/reports' },
];

const ADMIN_ITEMS = [
  { label: 'Settings', to: '/admin/settings/rules', match: '/admin/settings' },
  { label: 'Users', to: '/admin/users' },
];

const ROLE_LABELS = { USER: 'User', MODERATOR: 'Moderator', ADMIN: 'Admin' };

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function isActive(item, pathname) {
  if (item.exact) return pathname === item.to;
  const prefixes = [].concat(item.match ?? item.to);
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function MenuLink({ item, pathname, count }) {
  const active = isActive(item, pathname);

  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-between rounded px-3 py-2 text-[15px] ${focusRing} ${
        active ? 'bg-brand-tint font-semibold text-brand' : 'text-ink hover:bg-page'
      }`}
    >
      <span>{item.label}</span>
      {count > 0 && <span className="text-xs">{count}</span>}
    </Link>
  );
}

export default function DesktopLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // TODO(MF-31): menu counts from GET /api/moderator/dashboard.
  const counts = {};

  // logout() ends the session on the server and clears the user in the whole app
  // (it treats a failed request as logged out too). Then go to the login page.
  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-page print:block print:bg-surface">
      <aside className="sticky top-0 flex h-screen w-48 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 print:hidden">
        <div className="px-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">
            Metropolia
          </p>
          <p className="text-xl font-semibold text-ink">Furniture</p>
          <p className="text-xs text-muted">University of Applied Sciences</p>
        </div>

        <nav aria-label="Main menu" className="mt-8 flex flex-col gap-1">
          {MODERATOR_ITEMS.map((item) => (
            <MenuLink key={item.to} item={item} pathname={pathname} count={counts[item.countKey]} />
          ))}
          {user?.role === 'ADMIN' && (
            <>
              <hr className="my-3 border-line" />
              {ADMIN_ITEMS.map((item) => (
                <MenuLink key={item.to} item={item} pathname={pathname} />
              ))}
            </>
          )}
        </nav>

        {user && (
          <div className="mt-auto border-t border-line px-3 pt-4">
            <p className="text-[15px] font-semibold text-ink">{user.name || user.email}</p>
            <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <Link to="/mod/profile" className={`text-brand ${focusRing}`}>
                Profile
              </Link>
              <button type="button" onClick={handleLogout} className={`text-brand ${focusRing}`}>
                Log out
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 p-8 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
