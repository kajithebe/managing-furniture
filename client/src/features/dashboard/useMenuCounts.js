import { useEffect, useState } from 'react';
import { getDashboard } from '../../api/moderator.js';
import { REQUESTS_CHANGED } from '../requests/useWaitingCount.js';

const NO_COUNTS = { waiting: 0, notYetReturned: 0 };

// Side menu counts (M1, M2): "Requests 3" and "Not yet returned 2", from the dashboard tiles,
// so the menu and the dashboard always show the same numbers. Loads again on every page
// change and after each approve / decline (MF-31, replaces the requests-only count).
export function useMenuCounts(pathname) {
  const [counts, setCounts] = useState(NO_COUNTS);
  // Changing this number loads the counts again.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const reload = () => setVersion((value) => value + 1);
    window.addEventListener(REQUESTS_CHANGED, reload);
    return () => window.removeEventListener(REQUESTS_CHANGED, reload);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getDashboard({ signal: controller.signal })
      .then(({ tiles }) =>
        setCounts({ waiting: tiles.waitingForApproval, notYetReturned: tiles.notYetReturned }),
      )
      .catch(() => {
        // Keep the last counts: the page itself shows any load error.
      });

    return () => controller.abort();
  }, [pathname, version]);

  return counts;
}
