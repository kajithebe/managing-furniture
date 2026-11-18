import { NavLink } from 'react-router-dom';
import { REPORT_TABS } from './reportTabs.js';

// Top of every report tab (M9): "Reports", the tab's action button (Download CSV) and the tabs.
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default function ReportsHeader({ action }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink">Reports</h1>
        {action}
      </div>

      <nav aria-label="Reports" className="mt-6 flex gap-6 border-b border-line">
        {REPORT_TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={`/mod/reports/${tab.key}`}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-2 pb-2 text-[15px] ${focusRing} ${
                isActive
                  ? 'border-brand font-semibold text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <p className="mt-4 text-xs text-muted">
        Borrower emails are shown only to moderators and admins.
      </p>
    </>
  );
}
