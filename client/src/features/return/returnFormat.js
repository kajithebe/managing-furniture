// Text and list helpers for the return screens (S9, S10). Pure functions, no React.
import { countItems, formatDueTime } from '../loans/loanFormat.js';

// Items shown in the S9 list: the ones the student has (APPROVED, OVERDUE) and the ones already
// back (RETURNED). Waiting and declined items were never taken, so they are not listed.
const IN_LIST = ['APPROVED', 'OVERDUE', 'RETURNED'];

export function returnListItems(items) {
  return items.filter((item) => IN_LIST.includes(item.status));
}

// Items of the list that are not back yet.
export function notReturnedItems(listItems) {
  return listItems.filter((item) => item.status !== 'RETURNED');
}

// S9 "3 of 5 scanned".
export function scannedText(listItems) {
  const scanned = listItems.length - notReturnedItems(listItems).length;
  return `${scanned} of ${listItems.length} scanned`;
}

// S9 Finish return? pop-up, the text around the item names:
// "1 item is not returned yet (" … "). It stays on your loan until 14:00."
// "2 items are not returned yet (" … "). They stay on your loan until 14:00."
export function finishPromptText(count, dueAt, now = new Date()) {
  const one = count === 1;
  return {
    before: `${countItems(count)} ${one ? 'is' : 'are'} not returned yet (`,
    after: `). ${one ? 'It stays' : 'They stay'} on your loan until ${formatDueTime(dueAt, now)}.`,
  };
}

// S10 headline: "All 5 items are back in D569. Thank you!" (loan closed)
// or "4 items are back in D569." (partly returned).
export function doneText(backCount, allBack, roomName) {
  const verb = backCount === 1 ? 'is' : 'are';
  return allBack
    ? `All ${countItems(backCount)} ${verb} back in ${roomName}. Thank you!`
    : `${countItems(backCount)} ${verb} back in ${roomName}.`;
}

// S10 partly returned, the warn box around the item names:
// "1 item not yet returned: " … " · due 14:00. After that, a moderator will contact you."
export function notYetReturnedText(count, dueAt, now = new Date()) {
  return {
    before: `${countItems(count)} not yet returned: `,
    after: ` · due ${formatDueTime(dueAt, now)}. After that, a moderator will contact you.`,
  };
}
