import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { homePathFor, loginPathFor } from './returnTo.js';

export default function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for GET /auth/me, otherwise a logged-in user would flash to /login.
  if (loading) {
    return (
      <p role="status" className="p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to={loginPathFor(location)} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}
