import { createBrowserRouter } from 'react-router-dom';
import DesktopLayout from './components/layout/DesktopLayout.jsx';
import PhoneLayout from './components/layout/PhoneLayout.jsx';
import HomeRedirect from './features/auth/HomeRedirect.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import BorrowPage from './pages/BorrowPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ItemFormPage from './pages/ItemFormPage.jsx';
import ItemPage from './pages/ItemPage.jsx';
import ItemsPage from './pages/ItemsPage.jsx';
import LabelsPage from './pages/LabelsPage.jsx';
import LoginCodePage from './pages/LoginCodePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyLoansPage from './pages/MyLoansPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OverduePage from './pages/OverduePage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import RequestSentPage from './pages/RequestSentPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import RequestsPage from './pages/RequestsPage.jsx';
import ReturnPage from './pages/ReturnPage.jsx';

// Routes from 02-architecture-and-data-model.md › Frontend routes.
// Each card replaces its placeholder with the real page.
const placeholder = (title) => <PlaceholderPage title={title} />;

const STAFF = ['MODERATOR', 'ADMIN'];
const ADMIN_ONLY = ['ADMIN'];

export const router = createBrowserRouter([
  // Home: Dashboard or My loans, depending on the role (after login if needed).
  { element: <RequireAuth />, children: [{ path: '/', element: <HomeRedirect /> }] },

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
          { path: '/i/:code', element: <ItemPage /> },
          { path: '/borrow', element: <BorrowPage /> },
          { path: '/borrow/sent', element: <RequestSentPage /> },
          { path: '/loans', element: <MyLoansPage /> },
          { path: '/return/:loanId', element: <ReturnPage /> },
          { path: '/r/:qrToken', element: placeholder('Room') },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },

  // Moderator and admin (desktop)
  {
    element: <RequireAuth roles={STAFF} deniedLayout={PhoneLayout} />,
    children: [
      {
        element: <DesktopLayout />,
        children: [
          { path: '/mod', element: <DashboardPage /> },
          { path: '/mod/requests', element: <RequestsPage /> },
          { path: '/mod/overdue', element: <OverduePage /> },
          { path: '/mod/items', element: <ItemsPage /> },
          { path: '/mod/items/new', element: <ItemFormPage /> },
          { path: '/mod/items/:code', element: placeholder('Item') },
          { path: '/mod/items/:code/edit', element: <ItemFormPage /> },
          { path: '/mod/labels', element: <LabelsPage /> },
          { path: '/mod/reports/:report', element: <ReportsPage /> },
          { path: '/mod/profile', element: <ProfilePage desktop /> },
          {
            element: <RequireAuth roles={ADMIN_ONLY} />,
            children: [
              { path: '/admin/settings/:tab', element: placeholder('Settings') },
              { path: '/admin/users', element: <UsersPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);
