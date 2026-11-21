import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { homePathFor } from './returnTo.js';

// "/" opens the home page of the logged-in user: Dashboard for moderators and admins,
// My loans for students. It sits behind RequireAuth, so the user is known here; a visitor
// who is not logged in goes to /login first and comes back to "/" after the code.
export default function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathFor(user)} replace />;
}
