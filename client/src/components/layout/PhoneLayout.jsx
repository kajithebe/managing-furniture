import { useEffect, useId, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
const MENU_ITEM = `flex h-11 w-full items-center rounded px-3 text-left text-[15px] font-semibold text-brand hover:bg-page ${focusRing}`;

function getInitials(user) {
  const source = user.name?.trim() || user.email.split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// S11 · Account menu: the avatar opens My loans / Profile / Log out.
function AccountMenu({ user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on a click outside the menu, or on Esc (focus goes back to the avatar).
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand ${focusRing}`}
      >
        {getInitials(user)}
      </button>

      {open && (
        <nav
          id={menuId}
          aria-label="Account"
          className="absolute right-0 top-12 z-10 w-48 rounded-card border border-line bg-surface p-2"
        >
          <Link to="/loans" onClick={() => setOpen(false)} className={MENU_ITEM}>
            My loans
          </Link>
          <Link to="/profile" onClick={() => setOpen(false)} className={MENU_ITEM}>
            Profile
          </Link>
          <button type="button" onClick={handleLogout} className={MENU_ITEM}>
            Log out
          </button>
        </nav>
      )}
    </div>
  );
}

export default function PhoneLayout() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-page">
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-5">
        <span className="text-[17px] font-semibold text-ink">Metropolia Furniture</span>
        {user && <AccountMenu user={user} />}
      </header>
      <main className="flex flex-1 flex-col p-5">
        <Outlet />
      </main>
    </div>
  );
}
