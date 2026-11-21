// Small text helpers shared by the email templates.
// Times are shown in the server's time zone (TZ, Europe/Helsinki) in 24-hour form.
import { env } from '../config/env.js';
import { escapeHtml } from '../utils/escape.js';
import { FONT_MONO } from './layout.js';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: env.TZ,
});
const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: env.TZ,
});

// "14:00"
export function formatTime(date) {
  return timeFormat.format(date);
}

// "9 Nov"
export function formatDay(date) {
  return dayFormat.format(date);
}

// "Hello Aino," from "Aino Virtanen"; "Hello," when the user has no name yet.
export function greeting(userName) {
  const firstName = (userName ?? '').trim().split(/\s+/)[0];
  return firstName ? `Hello ${firstName},` : 'Hello,';
}

// "Table MP-02210" for the text version.
export function itemLabel(item) {
  return `${item.categoryName} ${item.code}`;
}

// The same for HTML: escaped, with the asset code in the code font (03 › Typography).
export function itemLabelHtml(item) {
  return `${escapeHtml(item.categoryName)} <span style="font-family:${FONT_MONO};">${escapeHtml(item.code)}</span>`;
}
