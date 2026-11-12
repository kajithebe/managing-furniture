import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';

// Menu from design-screens M1/M2 (moderator) and A2 (admin).
const MODERATOR_ITEMS = [
  { label: 'Dashboard', to: '/mod', exact: true },
  { label: 'Requests', to: '/mod/requests', countKey: 'waiting' },
  { label: 'Not yet returned', to: '/mod/overdue', countKey: 'notYetReturned' },
  { label: 'Items', to: '/mod/items', match: '/mod/items' },
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
  const prefix = item.match ?? item.to;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
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

  // TODO(MF-11): get the logged-in user from useAuth().
  const user = null;
  // TODO(MF-31): menu counts from GET /api/moderator/dashboard.
  const counts = {};

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      navigate('/login');
    }
  }

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 flex h-screen w-48 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
        <div className="px-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">Metropolia</p>
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
              <Link to="/profile" className={`text-brand ${focusRing}`}>
                Profile
              </Link>
              <button type="button" onClick={handleLogout} className={`text-brand ${focusRing}`}>
                Log out
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
