import { createBrowserRouter, Navigate } from 'react-router-dom';
import DesktopLayout from './components/layout/DesktopLayout.jsx';
import PhoneLayout from './components/layout/PhoneLayout.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import LoginCodePage from './pages/LoginCodePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

const placeholder = (title) => <PlaceholderPage title={title} />;

const STAFF = ['MODERATOR', 'ADMIN'];
const ADMIN_ONLY = ['ADMIN'];

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/loans" replace /> },

  // Student (phone)
  {
    element: <PhoneLayout />,
    children: [
      // Public: the login screens.
      { path: '/login', element: <LoginPage /> },
      { path: '/login/code', element: <LoginCodePage /> },

      // Everything else needs a login (any role).
      {
        element: <RequireAuth />,
        children: [
          { path: '/i/:code', element: placeholder('Item') },
          { path: '/borrow', element: placeholder('Borrow request') },
          { path: '/loans', element: placeholder('My loans') },
          { path: '/return/:loanId', element: placeholder('Return items') },
          { path: '/r/:qrToken', element: placeholder('Room') },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },

  // Moderator and admin (desktop)
  // Moderator and admin (desktop)
  {
    element: <RequireAuth roles={STAFF} deniedLayout={PhoneLayout} />,
    children: [
      {
        element: <DesktopLayout />,
        children: [
          { path: '/mod', element: placeholder('Dashboard') },
          { path: '/mod/requests', element: placeholder('Requests') },
          { path: '/mod/overdue', element: placeholder('Not yet returned') },
          { path: '/mod/items', element: placeholder('Items') },
          { path: '/mod/items/new', element: placeholder('Add item') },
          { path: '/mod/items/:code', element: placeholder('Item') },
          { path: '/mod/labels', element: placeholder('Labels') },
          { path: '/mod/reports/:report', element: placeholder('Reports') },
          {
            element: <RequireAuth roles={ADMIN_ONLY} />,
            children: [
              { path: '/admin/settings/:tab', element: placeholder('Settings') },
              { path: '/admin/users', element: placeholder('Users') },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);
