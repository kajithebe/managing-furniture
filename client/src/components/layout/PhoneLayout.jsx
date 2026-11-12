import { Link, Outlet } from 'react-router-dom';

function getInitials(user) {
  const source = user.name?.trim() || user.email.split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function PhoneLayout() {
  // TODO(MF-11): get the logged-in user from useAuth().
  const user = null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-page">
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-5">
        <span className="text-[17px] font-semibold text-ink">Metropolia Furniture</span>
        {user && (
          <Link
            to="/profile"
            aria-label="Profile"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {getInitials(user)}
          </Link>
        )}
      </header>
      <main className="flex flex-1 flex-col p-5">
        <Outlet />
      </main>
    </div>
  );
}
