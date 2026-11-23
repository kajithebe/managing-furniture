import { formatClock } from '../requests/format.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "9 Nov, 14:00" under "26 h late" on M1.
export function formatDayClock(value) {
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${formatClock(date)}`;
}

// "26 h late", "2 h late"; under an hour "45 min late". Counted to the moment the dashboard
// was loaded (updatedAt), so the numbers match "Updated 10:15".
export function formatLate(dueAt, now) {
  const minutes = Math.max(0, Math.floor((new Date(now) - new Date(dueAt)) / 60000));
  return minutes < 60 ? `${minutes} min late` : `${Math.floor(minutes / 60)} h late`;
}
