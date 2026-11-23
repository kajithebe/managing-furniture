import { useEffect, useState } from 'react';
import { getDashboard } from '../api/moderator.js';
import LoadError from '../components/ui/LoadError.jsx';
import DashboardTiles from '../features/dashboard/DashboardTiles.jsx';
import OverduePanel from '../features/dashboard/OverduePanel.jsx';
import WaitingPanel from '../features/dashboard/WaitingPanel.jsx';
import { formatClock } from '../features/requests/format.js';

// M1 Dashboard (moderators and admins). Everything comes from one call, loaded when the page
// opens and again on "Refresh"; there are no live updates and no campus filter (01 › Dashboard).

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default function DashboardPage() {
  const [state, setState] = useState({ status: 'loading', dashboard: null });
  // Changing this number loads the dashboard again (Refresh, Try again).
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getDashboard({ signal: controller.signal })
      .then((dashboard) => setState({ status: 'ready', dashboard }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', dashboard: null });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });

    // Leaving the page cancels the request, so no state update after unmount.
    return () => controller.abort();
  }, [attempt]);

  // Refresh keeps the current numbers on screen until the new ones arrive.
  function refresh() {
    setRefreshing(true);
    setAttempt((value) => value + 1);
  }

  // Try again: show Loading… while the dashboard loads again.
  function retry() {
    setState({ status: 'loading', dashboard: null });
    setAttempt((value) => value + 1);
  }

  const { status, dashboard } = state;

  let content;
  if (status === 'loading') {
    content = (
      <p role="status" className="text-sm text-muted">
        Loading…
      </p>
    );
  } else if (status === 'error') {
    content = (
      <LoadError
        message="Couldn't load the dashboard. Try again."
        text="We couldn't load the dashboard."
        onRetry={retry}
      />
    );
  } else {
    content = (
      <>
        <DashboardTiles tiles={dashboard.tiles} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <WaitingPanel rows={dashboard.waiting} />
          <OverduePanel rows={dashboard.overdue} now={dashboard.updatedAt} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink">Dashboard</h1>
        {dashboard && (
          // "Updated 10:15 · Refresh"
          <p className="text-[13px] text-muted" aria-live="polite">
            {refreshing ? 'Updating…' : `Updated ${formatClock(dashboard.updatedAt)}`}
            {' · '}
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className={`text-brand hover:underline disabled:text-muted ${focusRing}`}
            >
              Refresh
            </button>
          </p>
        )}
      </div>

      <div className="mt-6">{content}</div>
    </>
  );
}
