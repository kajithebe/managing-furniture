import { createBrowserRouter, Navigate } from 'react-router-dom';
import DesktopLayout from './components/layout/DesktopLayout.jsx';
import PhoneLayout from './components/layout/PhoneLayout.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';

// Routes from 02-architecture-and-data-model.md › Frontend routes.
// Each card replaces its placeholder with the real page.
const placeholder = (title) => <PlaceholderPage title={title} />;

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/loans" replace /> },

  // Student (phone)
  {
    element: <PhoneLayout />,
    children: [
      { path: '/login', element: placeholder('Log in') },
      { path: '/login/code', element: placeholder('Enter code') },
      { path: '/i/:code', element: placeholder('Item') },
      { path: '/borrow', element: placeholder('Borrow request') },
      { path: '/loans', element: placeholder('My loans') },
      { path: '/return/:loanId', element: placeholder('Return items') },
      { path: '/r/:qrToken', element: placeholder('Room') },
      { path: '/profile', element: placeholder('Profile') },
    ],
  },

  // Moderator and admin (desktop)
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
      { path: '/admin/settings/:tab', element: placeholder('Settings') },
      { path: '/admin/users', element: placeholder('Users') },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);
