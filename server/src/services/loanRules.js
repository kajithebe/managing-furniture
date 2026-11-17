// Borrowing rules (01 › Core rules, 02 › Item status shown in the app).
// Plain functions without database access, so the rules are easy to test and are the same
// for a new borrow request (POST /loans) and for a moderator approving an item.
// Error texts follow the design: S3 (item page) and S4 (borrow request).
import { AppError } from '../middleware/error.js';

const HOUR = 60 * 60 * 1000;

// The browser and the server clock can differ a little, so an until-time that is up to
// one minute over the limit is still accepted.
const CLOCK_TOLERANCE = 60 * 1000;

// Words used in messages, e.g. "This item can't be borrowed right now (Broken)".
const STATUS_LABEL = {
  AVAILABLE: 'Available',
  ON_LOAN: 'On loan',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// Shown status from onLoan + condition, the same values as the items API (MF-08) returns.
export function shownStatus(item) {
  if (item.onLoan) {
    return 'ON_LOAN';
  }
  return item.condition === 'GOOD' ? 'AVAILABLE' : item.condition;
}

// Only items that are not on loan and in condition Good or Needs repair can be borrowed.
export function isBorrowable(item) {
  return !item.onLoan && (item.condition === 'GOOD' || item.condition === 'NEEDS_REPAIR');
}

// The first status of an item in a new request: approved at once when its category
// approves automatically (Chair, Stool by default), otherwise it waits for a moderator.
export function initialStatus(item) {
  return item.category.autoApprove ? 'APPROVED' : 'PENDING';
}

function hoursText(hours) {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

// One until-time for the whole request: later than now and at most maxLoanHours from now.
export function checkDueAt(dueAt, maxLoanHours, now = new Date()) {
  if (dueAt.getTime() <= now.getTime()) {
    throw new AppError(400, 'DUE_IN_PAST', 'Choose an until time later than now.');
  }
  if (dueAt.getTime() - now.getTime() > maxLoanHours * HOUR + CLOCK_TOLERANCE) {
    throw new AppError(
      400,
      'LOAN_TOO_LONG',
      `Until time is longer than ${hoursText(maxLoanHours)}.`,
      { maxLoanHours },
    );
  }
}

// S3: "We couldn't find item MP-99999. Check the code on the sticker."
export function itemNotFound(code) {
  return new AppError(
    404,
    'ITEM_NOT_FOUND',
    `We couldn't find item ${code}. Check the code on the sticker.`,
    { itemCode: code },
  );
}

// Throws when any item cannot be borrowed. The whole request is refused, and the error lists
// the items, so S4 can mark them and the student can remove them and send again.
// Items on loan come first: that is the case S4 shows ("borrowed by someone else meanwhile").
export function checkBorrowable(items) {
  const onLoan = items.filter((item) => item.onLoan);
  if (onLoan.length > 0) {
    const codes = onLoan.map((item) => item.code).join(', ');
    const message =
      onLoan.length === 1
        ? `One item was borrowed by someone else meanwhile: ${codes}`
        : `${onLoan.length} items were borrowed by someone else meanwhile: ${codes}`;
    throw new AppError(409, 'ITEM_NOT_AVAILABLE', message, { items: statusList(onLoan) });
  }

  const blocked = items.filter((item) => !isBorrowable(item));
  if (blocked.length > 0) {
    const message =
      blocked.length === 1
        ? `This item can't be borrowed right now (${STATUS_LABEL[shownStatus(blocked[0])]})`
        : `${blocked.length} items can't be borrowed right now: ${blocked
            .map((item) => `${item.code} (${STATUS_LABEL[shownStatus(item)]})`)
            .join(', ')}`;
    throw new AppError(409, 'ITEM_NOT_BORROWABLE', message, { items: statusList(blocked) });
  }
}

function statusList(items) {
  return items.map((item) => ({ code: item.code, status: shownStatus(item) }));
}
