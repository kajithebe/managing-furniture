import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import AccessDenied from './AccessDenied.jsx';
import { loginPathFor } from './returnTo.js';

// deniedLayout: the layout to show "no access" in when this guard sits outside a layout
// (e.g. the moderator pages: a student sees the message in the phone layout).
export default function RequireAuth({ roles, deniedLayout: DeniedLayout }) {
  const { user, loading, loggedOut } = useAuth();
  const location = useLocation();

  // Wait for GET /auth/me, otherwise a logged-in user would flash to /login.
  if (loading) {
    return (
      <p role="status" className="p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  // Not logged in: back here after the login (returnTo), e.g. to a scanned item. Right after
  // "Log out" there is nothing to come back to, so plain /login.
  if (!user) {
    return <Navigate to={loggedOut ? '/login' : loginPathFor(location)} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const denied = <AccessDenied />;
    return DeniedLayout ? <DeniedLayout>{denied}</DeniedLayout> : denied;
  }

  return <Outlet />;
}
