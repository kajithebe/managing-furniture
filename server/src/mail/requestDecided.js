// Email 2: a moderator approved or declined one item of a borrow request
// (design: figma-4-emails, "Email 2" and "Email 2 · declined variant").
// One email per decided item; a declined item never cancels the others in the request.
//
// User text here: user name, category name, room names, reason, note, moderator name.
// All of it goes through escapeHtml before it is put into the HTML.
import { escapeHtml } from '../utils/escape.js';
import { formatTime, greeting, itemLabel, itemLabelHtml } from './format.js';
import { COLOR, appUrl, htmlEmail, paragraph, textEmail } from './layout.js';

// The moderator's note in a bordered box, as in the design.
function noteBoxHtml(heading, note) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
                  <tr>
                    <td style="padding:12px 16px;border:1px solid ${COLOR.line};border-radius:10px;">
                      <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${COLOR.muted};">${escapeHtml(heading)}</p>
                      <p style="margin:0;font-size:15px;line-height:22px;color:${COLOR.ink};">${escapeHtml(note)}</p>
                    </td>
                  </tr>
                </table>`;
}

// approved: true or false
// item: { code, categoryName }
// fromRoom, toRoom, homeRoom: room names, e.g. "D569"
// dueAt: Date · note, moderatorName: optional
// otherApprovedCount: how many other items of the same request are approved (declined email only)
export function requestDecidedMail({
  userName,
  approved,
  item,
  fromRoom,
  toRoom,
  homeRoom,
  reason,
  dueAt,
  note,
  moderatorName,
  otherApprovedCount = 0,
}) {
  const category = item.categoryName.toLowerCase();
  const title = approved
    ? `Your ${category} request is approved`
    : `Your ${category} request was declined`;
  const hello = greeting(userName);
  const route = `${fromRoom} → ${toRoom} · ${reason}`;
  const noteHeading = moderatorName ? `Note from ${moderatorName}` : 'Note from the moderator';
  const button = { label: 'Open my loans', url: appUrl('/loans') };

  // The last line differs: where to bring it back, or what is still approved.
  let closing = '';
  if (approved) {
    closing = `Please bring it back to ${homeRoom} by ${formatTime(dueAt)}`;
  } else if (otherApprovedCount === 1) {
    closing = '1 other item in this request is still approved.';
  } else if (otherApprovedCount > 1) {
    closing = `${otherApprovedCount} other items in this request are still approved.`;
  }

  const lines = [title, '', hello, '', itemLabel(item), route];
  if (note) {
    lines.push('', `${noteHeading}:`, note);
  }
  if (closing) {
    lines.push('', closing);
  }

  const bodyHtml = [
    paragraph(escapeHtml(hello)),
    paragraph(`${itemLabelHtml(item)}<br>${escapeHtml(route)}`),
    note ? noteBoxHtml(noteHeading, note) : '',
    closing ? paragraph(escapeHtml(closing)) : '',
  ].join('');

  return {
    subject: title,
    text: textEmail({ lines, button }),
    html: htmlEmail({ title, bodyHtml, button }),
  };
}
