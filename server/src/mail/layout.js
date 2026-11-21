// Shared look of every system email (03 › Email): cream page, white 600 px card,
// "Metropolia Furniture" header, title, body, at most one button, footer.
// Email programs ignore stylesheets, so the layout uses tables and inline styles.
//
// Rule for templates: htmlEmail() escapes the title and the button for you, but `bodyHtml`
// is inserted as it is. Build it with paragraph() and pass all user text (names, reasons,
// notes) through escapeHtml first.
import { env } from '../config/env.js';
import { escapeHtml } from '../utils/escape.js';

// Colours and fonts from 03-design-system.md. Do not add new ones here.
export const COLOR = {
  brand: '#17675E',
  ink: '#243B3A',
  muted: '#61716E',
  line: '#D9DFD9',
  page: '#F5F4EF',
  surface: '#FFFFFF',
};
export const FONT_SANS = "'Source Sans 3', system-ui, sans-serif";
export const FONT_MONO = "'Source Code Pro', ui-monospace, monospace";

const APP_NAME = 'Metropolia Furniture';
const ORGANISATION = 'Metropolia University of Applied Sciences';

// Full link into the app, e.g. appUrl('/loans'). Links are built only from BASE_URL and a
// fixed path, never from user input (02 › Security).
export function appUrl(path) {
  return `${env.BASE_URL.replace(/\/+$/, '')}${path}`;
}

// One body paragraph. `html` must already be escaped.
export function paragraph(html) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:${COLOR.ink};">${html}</p>`;
}

function buttonHtml({ label, url }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
                <tr>
                  <td style="background-color:${COLOR.brand};border-radius:6px;">
                    <a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 16px;font-family:${FONT_SANS};font-size:15px;line-height:22px;font-weight:600;color:${COLOR.surface};text-decoration:none;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table>`;
}

// The complete HTML email.
// title: plain text, shown as the heading. bodyHtml: escaped HTML. button: { label, url } or nothing.
export function htmlEmail({ title, bodyHtml, button }) {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLOR.page};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.page};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${COLOR.surface};border:1px solid ${COLOR.line};border-radius:10px;">
            <tr>
              <td style="padding:24px 32px;font-family:${FONT_SANS};color:${COLOR.ink};">
                <p style="margin:0;font-size:15px;line-height:22px;font-weight:600;color:${COLOR.brand};">${APP_NAME}</p>
                <hr style="border:0;border-top:1px solid ${COLOR.line};margin:16px 0 24px;">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:600;color:${COLOR.ink};">${safeTitle}</h1>
                ${bodyHtml}
                ${button ? buttonHtml(button) : ''}
                <hr style="border:0;border-top:1px solid ${COLOR.line};margin:24px 0 16px;">
                <p style="margin:0;font-size:12px;line-height:18px;color:${COLOR.muted};">${ORGANISATION}<br>${APP_NAME}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

// The plain-text version of the same email, for mail programs that do not show HTML.
// lines: array of text lines ('' gives an empty line). button: { label, url } or nothing.
export function textEmail({ lines, button }) {
  const parts = [...lines];
  if (button) {
    parts.push('', `${button.label}: ${button.url}`);
  }
  parts.push('', '--', `${ORGANISATION} · ${APP_NAME}`);
  return `${parts.join('\n')}\n`;
}
