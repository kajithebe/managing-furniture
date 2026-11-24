// Sent by the Waiting list after approve / decline, so the side menu counts update at once.
// The counts themselves come from the dashboard (features/dashboard/useMenuCounts.js, MF-31).
export const REQUESTS_CHANGED = 'mf:requests-changed';

export function notifyRequestsChanged() {
  window.dispatchEvent(new Event(REQUESTS_CHANGED));
}
