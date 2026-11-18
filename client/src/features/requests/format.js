const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Times on M2: "until 14:00", "sent 9:58" (no leading zero on the hour).
export function formatClock(value) {
  const date = new Date(value);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// "When" column on M2 Decided today: "9 Nov 2026, 10:12".
export function formatDateTime(value) {
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${formatClock(date)}`;
}

// "Waiting for" column: "12 min", then "2 h 30 min" like the S4 until list.
export function formatWaitingFor(createdAt, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
