// Texts for the item details on S3 (item page), shared with the borrow form.

// "Karaportti · D · D569": campus, building and room.
export function roomPath(room) {
  if (!room) return '–';
  return [room.building?.campus?.name, room.building?.name, room.name].filter(Boolean).join(' · ');
}

// "No" or "Yes · 5 wheels".
export function wheelsText(item) {
  if (!item.hasWheels) return 'No';
  return `Yes · ${item.wheelCount} ${item.wheelCount === 1 ? 'wheel' : 'wheels'}`;
}

// English plural of a category name: Chair → Chairs, Shelf → Shelves, Bench → Benches.
export function plural(name) {
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
  if (/lf$/i.test(name)) return `${name.slice(0, -1)}ves`;
  return `${name}s`;
}

// S3 "Approval" row, from the category's auto-approve setting.
export function approvalText(category) {
  const names = plural(category.name.trim());
  return category.autoApprove
    ? `${names} are approved automatically`
    : `${names} need a moderator's approval`;
}

// Due time: "14:00" when it is today, otherwise "20 Nov, 14:00".
export function dueText(dueAt, now = new Date()) {
  const due = new Date(dueAt);
  const time = due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (due.toDateString() === now.toDateString()) return time;
  const day = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}
