import { Navigate, NavLink, useParams } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import AssetCodesTab from '../features/settings/AssetCodesTab.jsx';
import { SETTINGS_TABS } from '../features/settings/settingsTabs.js';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// The content of each tab. Loan rules and Categories come with MF-25, Locations with MF-30,
// Asset codes with MF-21.
const TAB_CONTENT = {
  codes: AssetCodesTab,
};

// /admin/settings/:tab – A1 Settings (admins only; the server checks the role too).
export default function SettingsPage() {
  const { tab } = useParams();

  if (!SETTINGS_TABS.some((entry) => entry.key === tab)) {
    return <Navigate to="/admin/settings/rules" replace />;
  }

  const Content = TAB_CONTENT[tab];

  return (
    <>
      <h1 className="text-[28px] font-semibold text-ink">Settings</h1>

      <nav aria-label="Settings" className="mt-6 flex gap-6 border-b border-line">
        {SETTINGS_TABS.map((entry) => (
          <NavLink
            key={entry.key}
            to={`/admin/settings/${entry.key}`}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-2 pb-2 text-[15px] ${focusRing} ${
                isActive
                  ? 'border-brand font-semibold text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`
            }
          >
            {entry.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4">
        {Content ? (
          <Content />
        ) : (
          <Card>
            <p className="text-muted">This tab is not built yet.</p>
          </Card>
        )}
      </div>
    </>
  );
}
