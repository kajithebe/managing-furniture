// Reminder and "not yet returned" rules (MF-20, 01 › Core rules 6 and 7).
// Plain functions without database access, so the rules are easy to test.
// The job in jobs/reminders.js runs every 5 minutes and uses these to decide what to do.
// A late item is "not yet returned" (LoanItem OVERDUE): there is no "missing" status.

const MINUTE = 60 * 1000;
export const REPEAT_AFTER_MS = 24 * 60 * MINUTE;

// When the item went on loan: the moderator's approval time, or the request time for an
// auto-approved item (those have no decidedAt).
export function approvedAt(loanItem) {
  return loanItem.decidedAt ?? loanItem.loan.createdAt;
}

// The moment the reminder may be sent: [reminderMinutes] before the due time.
export function reminderStart(dueAt, reminderMinutes) {
  return new Date(dueAt.getTime() - reminderMinutes * MINUTE);
}

// True when the reminder email (email 3) should go out now for this loan item:
// - the item is on loan (APPROVED) and has had no reminder yet,
// - the reminder time has started and the due time has not passed yet
//   (after a server break past the due time, the "not yet returned" email comes instead),
// - the item went on loan before the reminder time started: a 20-minute loan with a
//   30-minute reminder gets no reminder right after approval (decided 24 Nov 2026).
// `loanItem`: { status, reminderSentAt, decidedAt, loan: { dueAt, createdAt } }
export function needsReminder(loanItem, now, reminderMinutes) {
  if (loanItem.status !== 'APPROVED' || loanItem.reminderSentAt) {
    return false;
  }
  const { dueAt } = loanItem.loan;
  const start = reminderStart(dueAt, reminderMinutes);
  return now >= start && now < dueAt && approvedAt(loanItem) <= start;
}

// True when an item on loan has passed its due time and becomes "not yet returned".
export function isPastDue(loanItem, now) {
  return loanItem.status === 'APPROVED' && loanItem.loan.dueAt <= now;
}

// Which "not yet returned" email this OVERDUE item needs now:
// 'first' (email 4, at the due time), 'repeat' (email 5, every 24 h after the last one,
// only while the setting is on) or null (nothing to send).
// The job runs every 5 minutes, so an email can come up to 5 minutes after its time.
// `loanItem`: { status, lastOverdueEmailAt }
export function overdueEmailKind(loanItem, now, repeatOverdueEmail) {
  if (loanItem.status !== 'OVERDUE') {
    return null;
  }
  if (!loanItem.lastOverdueEmailAt) {
    return 'first';
  }
  if (repeatOverdueEmail && now - loanItem.lastOverdueEmailAt >= REPEAT_AFTER_MS) {
    return 'repeat';
  }
  return null;
}

// One email covers the items of one loan that go back to the same home room (the email
// templates are built this way). Groups keep the order of the input.
// `loanItems`: [{ id, loanId, item: { code, category: { name }, homeRoom: { id, name } },
//                 loan: { dueAt, user: { email } } }]
// Returns [{ loanId, email, dueAt, homeRoom, loanItemIds, items: [{ code, categoryName }] }]
export function groupForEmail(loanItems) {
  const groups = new Map();
  for (const loanItem of loanItems) {
    const { homeRoom } = loanItem.item;
    const key = `${loanItem.loanId}:${homeRoom.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        loanId: loanItem.loanId,
        email: loanItem.loan.user.email,
        dueAt: loanItem.loan.dueAt,
        homeRoom: homeRoom.name,
        loanItemIds: [],
        items: [],
      });
    }
    const group = groups.get(key);
    group.loanItemIds.push(loanItem.id);
    group.items.push({ code: loanItem.item.code, categoryName: loanItem.item.category.name });
  }
  return [...groups.values()];
}
