// Emails 4 and 5: an item is late (design: figma-4-emails, "Email 4" and "Email 5").
// notYetReturnedMail: the first email, sent when the due time has passed.
// stillNotReturnedMail: the repeat, sent every 24 h while the item is still out,
// with slightly different wording and the due date.
// A late item is "not yet returned": there is no "missing" status.
// One email covers the items that go back to the same home room.
//
// User text here: category names and room names. Both are escaped in the HTML.
import { escapeHtml } from '../utils/escape.js';
import { formatDay, formatTime, itemLabel, itemLabelHtml } from './format.js';
import { appUrl, htmlEmail, paragraph, textEmail } from './layout.js';

const ALREADY_RETURNED = 'If you already did, reply to this email and a moderator will check.';

// Builds both versions from the same parts.
// opening: { text, html } first sentence(s) · listItems: items shown as a list (may be empty)
// closing: sentences after the list
function build({ subject, title, opening, listItems, closing }) {
  const button = { label: 'Open my loans', url: appUrl('/loans') };

  const lines = [title, '', opening.text];
  if (listItems.length > 0) {
    lines.push('', ...listItems.map((item) => `• ${itemLabel(item)}`));
  }
  closing.forEach((sentence) => lines.push('', sentence));

  const bodyHtml = [
    paragraph(opening.html),
    ...listItems.map((item) => paragraph(`• ${itemLabelHtml(item)}`)),
    ...closing.map((sentence) => paragraph(escapeHtml(sentence))),
  ].join('');

  return {
    subject,
    text: textEmail({ lines, button }),
    html: htmlEmail({ title, bodyHtml, button }),
  };
}

// homeRoom: room name, e.g. "D569" · dueAt: Date
// items: [{ code, categoryName }], at least one
export function notYetReturnedMail({ homeRoom, dueAt, items }) {
  const count = items.length;
  const when = `in ${homeRoom} at ${formatTime(dueAt)}`;

  if (count === 1) {
    const title = '1 item is not yet returned';
    const rest = `was due back ${when} and hasn't been scanned in yet. Please return it as soon as you can. ${ALREADY_RETURNED}`;
    return build({
      subject: title,
      title,
      opening: {
        text: `${itemLabel(items[0])} ${rest}`,
        html: `${itemLabelHtml(items[0])} ${escapeHtml(rest)}`,
      },
      listItems: [],
      closing: [],
    });
  }

  const title = `${count} items are not yet returned`;
  const opening = `These ${count} items were due back ${when} and haven't been scanned in yet:`;
  return build({
    subject: title,
    title,
    opening: { text: opening, html: escapeHtml(opening) },
    listItems: items,
    closing: [`Please return them as soon as you can. ${ALREADY_RETURNED}`],
  });
}

// Same input as notYetReturnedMail.
export function stillNotReturnedMail({ homeRoom, dueAt, items }) {
  const count = items.length;
  const day = formatDay(dueAt);
  const when = `in ${homeRoom} on ${day} at ${formatTime(dueAt)}`;
  const title = 'Still not returned';

  if (count === 1) {
    const rest = `was due back ${when}. Please bring it back as soon as you can.`;
    return build({
      subject: `Still not returned: ${itemLabel(items[0])} (due ${day})`,
      title,
      opening: {
        text: `${itemLabel(items[0])} ${rest}`,
        html: `${itemLabelHtml(items[0])} ${escapeHtml(rest)}`,
      },
      listItems: [],
      closing: [ALREADY_RETURNED],
    });
  }

  const opening = `These ${count} items were due back ${when}:`;
  return build({
    subject: `Still not returned: ${count} items (due ${day})`,
    title,
    opening: { text: opening, html: escapeHtml(opening) },
    listItems: items,
    closing: ['Please bring them back as soon as you can.', ALREADY_RETURNED],
  });
}
