import { formatDayClock } from '../dashboard/format.js';
import { formatClock } from '../requests/format.js';

// The yellow message on M4: "2 items are not yet returned. Contact the borrower or confirm
// a return." With one item: "1 item is not yet returned. …" (plural wording only).
export function overdueMessage(count) {
  const items = count === 1 ? '1 item is' : `${count} items are`;
  return `${items} not yet returned. Contact the borrower or confirm a return.`;
}

// "Late by" column: "26 h" (full hours from the API, the same number as in the CSV).
// In the first hour after the due time: "45 min", like the dashboard.
export function formatLateBy(row, now = Date.now()) {
  if (row.hoursLate >= 1) {
    return `${row.hoursLate} h`;
  }
  const minutes = Math.max(0, Math.floor((now - new Date(row.dueAt).getTime()) / 60000));
  return `${minutes} min`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// "Last contacted" column: "Today 10:05", an earlier day "9 Nov, 14:00", never "—".
export function formatContacted(value, now = new Date()) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return sameDay(date, now) ? `Today ${formatClock(date)}` : formatDayClock(date);
}
