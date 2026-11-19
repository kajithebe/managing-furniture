// Text and status helpers for S6 Request sent and S7 My loans.
// Pure functions (no React), so the pages stay small and the wording lives in one place.

// "Due soon" warning starts this many minutes before the due time.
// Same as the default reminder time in the loan rules (needs team agreement).
export const DUE_SOON_MINUTES = 30;

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

// 14:00 (24 h, the phone's own time zone)
export function formatTime(value) {
  return timeFormat.format(new Date(value));
}

// 9 Nov
export function formatDay(value) {
  return dayFormat.format(new Date(value));
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// "1 item" / "4 items"
export function countItems(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

// The due line of an open loan card (S7):
//   normal → "Due 14:00" (or "Due 19 Nov 14:00" when not today)
//   soon   → "Due today 14:00 · 30 min left"
//   late   → "Late since 14:00"
export function dueInfo(dueAt, now = new Date()) {
  const due = new Date(dueAt);
  const time = formatTime(due);
  const minutesLeft = Math.ceil((due.getTime() - now.getTime()) / 60000);

  if (minutesLeft <= 0) {
    const since = isSameDay(due, now) ? time : `${formatDay(due)} ${time}`;
    return { kind: 'late', text: `Late since ${since}` };
  }
  if (minutesLeft <= DUE_SOON_MINUTES) {
    return { kind: 'soon', text: `Due today ${time} · ${minutesLeft} min left` };
  }
  const when = isSameDay(due, now) ? time : `${formatDay(due)} ${time}`;
  return { kind: 'normal', text: `Due ${when}` };
}

// Loan item status (API) → Badge status (UI kit).
// An approved item past its due time shows "Not yet returned" straight away,
// even before the reminders job (MF-20) has set it to OVERDUE.
export function itemBadgeStatus(itemStatus, dueAt, now = new Date()) {
  switch (itemStatus) {
    case 'PENDING':
      return 'pending';
    case 'APPROVED':
      return new Date(dueAt) <= now ? 'overdue' : 'approved';
    case 'DECLINED':
      return 'declined';
    case 'RETURNED':
      return 'returned';
    case 'OVERDUE':
      return 'overdue';
    default:
      return null;
  }
}

// Home rooms of the items, without repeats, in the order they appear.
export function homeRoomNames(items) {
  return [...new Set(items.map((item) => item.homeRoom?.name).filter(Boolean))];
}

// S6 Request sent: the green and orange boxes. A box is null when its count is 0.
export function requestSummary(loan) {
  const approved = loan.items.filter((item) => item.status === 'APPROVED').length;
  const waiting = loan.items.filter((item) => item.status === 'PENDING').length;

  let approvedText = null;
  if (approved > 0) {
    const them = approved === 1 ? 'it' : 'them';
    const rooms = homeRoomNames(loan.items.filter((item) => item.status === 'APPROVED'));
    // "back in D569" only when all items share one home room (needs team agreement).
    const back = rooms.length === 1 ? `back in ${rooms[0]}` : 'back';
    approvedText =
      `${countItems(approved)} approved: you can take ${them} now. ` +
      `Move to ${loan.toRoom.name} · ${back} by ${formatTime(loan.dueAt)}.`;
  }

  let waitingText = null;
  if (waiting > 0) {
    const verb = waiting === 1 ? 'is' : 'are';
    const pronoun = waiting === 1 ? "it's" : "they're";
    waitingText =
      `${countItems(waiting)} ${verb} waiting for a moderator. ` +
      `We'll email you when ${pronoun} approved or declined.`;
  }

  return { approved, waiting, approvedText, waitingText };
}

// S7 Recent loans card title: "9 Nov · 5 items · returned".
// "declined" when no item was ever approved (needs team agreement).
export function recentTitle(loan) {
  const allDeclined = loan.items.every((item) => item.status === 'DECLINED');
  const day = formatDay(loan.closedAt ?? loan.createdAt);
  return `${day} · ${countItems(loan.items.length)} · ${allDeclined ? 'declined' : 'returned'}`;
}
