// Email 3: reminder shortly before the due time (design: figma-4-emails, "Email 3").
// Sent by the reminders job to the borrower, with the items that are still out.
// One email covers the items that go back to the same home room.
//
// User text here: category names and room names. Both are escaped in the HTML.
import { escapeHtml } from '../utils/escape.js';
import { formatTime, itemLabel, itemLabelHtml } from './format.js';
import { appUrl, htmlEmail, paragraph, textEmail } from './layout.js';

// loanId: number, used for the "Start return" link
// homeRoom: room name, e.g. "D569" · dueAt: Date
// items: [{ code, categoryName }], at least one
export function reminderMail({ loanId, homeRoom, dueAt, items }) {
  const count = items.length;
  const itemsWord = count === 1 ? '1 item' : `${count} items`;
  const until = formatTime(dueAt);

  const title = 'Time to bring your furniture back';
  const intro =
    count === 1
      ? `Please return this item to ${homeRoom} by ${until}:`
      : `Please return these ${count} items to ${homeRoom} by ${until}:`;
  const howTo = `Go to ${homeRoom}, scan the room's QR sticker, then scan each item.`;
  const button = { label: 'Start return', url: appUrl(`/return/${loanId}`) };

  const lines = [title, '', intro, '', ...items.map((item) => `• ${itemLabel(item)}`), '', howTo];

  const bodyHtml = [
    paragraph(escapeHtml(intro)),
    ...items.map((item) => paragraph(`• ${itemLabelHtml(item)}`)),
    paragraph(escapeHtml(howTo)),
  ].join('');

  return {
    subject: `Reminder: return ${itemsWord} to ${homeRoom} by ${until}`,
    text: textEmail({ lines, button }),
    html: htmlEmail({ title, bodyHtml, button }),
  };
}
