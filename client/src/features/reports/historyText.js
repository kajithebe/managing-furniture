// Words for item history events (MF-32), shared by the Item history report and the item page
// timeline (M7 History). The same words as the Item history CSV (server reportService.js).
const EVENT_LABELS = {
  CREATED: 'Created',
  EDITED: 'Edited',
  BORROWED: 'Borrowed',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  RETURNED: 'Returned (scanned)',
  MARKED_RETURNED: 'Marked returned',
  OVERDUE: 'Not yet returned',
  STATUS_CHANGED: 'Status changed',
  LOCATION_CORRECTED: 'Location corrected',
  HOME_CHANGED: 'Home room changed',
};

// A condition as the item's status badge shows it (02 › Item status shown in the app).
const CONDITION_LABELS = {
  GOOD: 'Available',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// "Status changed to Needs repair" when the new condition is known, else e.g. "Borrowed".
export function eventLabel(event) {
  const label = EVENT_LABELS[event.type] ?? event.type;
  return event.condition ? `${label} to ${CONDITION_LABELS[event.condition]}` : label;
}

// "D569 → D751", "→ D751" when only the target room is known, or "—" without rooms.
export function roomMove(fromRoom, toRoom) {
  if (fromRoom && toRoom) return `${fromRoom.name} → ${toRoom.name}`;
  if (toRoom) return `→ ${toRoom.name}`;
  if (fromRoom) return `${fromRoom.name} →`;
  return '—';
}
