import { Link, useSearchParams } from 'react-router-dom';

// M2 Requests (desktop): Waiting and Decided today tabs.
// The tab lives in the URL (?tab=decided), so reload and back keep it.
const TABS = [
  { key: 'waiting', label: 'Waiting', to: '/mod/requests' },
  { key: 'decided', label: 'Decided today', to: '/mod/requests?tab=decided' },
];

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default function RequestsPage() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'decided' ? 'decided' : 'waiting';

  return (
    <div>
      <h1 className="text-[28px] font-semibold text-ink">Requests</h1>

      <nav aria-label="Request tabs" className="mt-4 flex gap-6 border-b border-line">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-1 pb-2 text-[15px] ${focusRing} ${
                active
                  ? 'border-brand font-semibold text-brand'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Step 2 adds the Waiting list, step 6 the Decided today table. */}
      <section
        aria-label={activeTab === 'decided' ? 'Decided today' : 'Waiting'}
        className="mt-6"
      />
    </div>
  );
}
