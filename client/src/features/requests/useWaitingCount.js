import { useEffect, useState } from 'react';
import { getWaitingRequests } from '../../api/moderator.js';

// Sent by the Waiting list after approve / decline, so the side menu count updates at once.
const REQUESTS_CHANGED = 'mf:requests-changed';

export function notifyRequestsChanged() {
  window.dispatchEvent(new Event(REQUESTS_CHANGED));
}

// "Requests" count in the side menu (M2) = waitingItems from GET /moderator/requests.
// Loads again on every page change and after each decision.
// TODO(MF-31): replace with the menu counts from GET /api/moderator/dashboard.
export function useWaitingCount(pathname) {
  const [count, setCount] = useState(0);
  // Changing this number loads the count again.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const reload = () => setVersion((value) => value + 1);
    window.addEventListener(REQUESTS_CHANGED, reload);
    return () => window.removeEventListener(REQUESTS_CHANGED, reload);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getWaitingRequests({ signal: controller.signal })
      .then((result) => setCount(result.waitingItems))
      .catch(() => {
        // Keep the last count: the page itself shows any load error.
      });

    return () => controller.abort();
  }, [pathname, version]);

  return count;
}
