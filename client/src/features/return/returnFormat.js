// Text and list helpers for the return screens (S9, S10). Pure functions, no React.

// Items shown in the S9 list: the ones the student has (APPROVED, OVERDUE) and the ones already
// back (RETURNED). Waiting and declined items were never taken, so they are not listed.
const IN_LIST = ['APPROVED', 'OVERDUE', 'RETURNED'];

export function returnListItems(items) {
  return items.filter((item) => IN_LIST.includes(item.status));
}

// S9 "3 of 5 scanned".
export function scannedText(listItems) {
  const scanned = listItems.filter((item) => item.status === 'RETURNED').length;
  return `${scanned} of ${listItems.length} scanned`;
}
