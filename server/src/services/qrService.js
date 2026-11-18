// QR codes for the printed labels (MF-09).
// Item sticker → BASE_URL/i/<code>    opens the item page (S3)
// Room door    → BASE_URL/r/<qrToken> opens the room page (S12)
// BASE_URL comes from the environment, so the same image prints the right links on the demo
// server and at Metropolia.
import QRCode from 'qrcode';
import { env } from '../config/env.js';

// "https://example.com/" and "https://example.com" give the same links.
const baseUrl = env.BASE_URL.replace(/\/+$/, '');

// Item codes only use A–Z, 0–9 and the separator, but encoding keeps the link valid
// even if a future code scheme (MF-21) uses "/" as the separator.
export function itemQrUrl(code) {
  return `${baseUrl}/i/${encodeURIComponent(code)}`;
}

// 02 › Security: the door QR holds the random qrToken, never the room name.
export function roomQrUrl(qrToken) {
  return `${baseUrl}/r/${encodeURIComponent(qrToken)}`;
}

const QR_OPTIONS = {
  type: 'svg',
  // M = about 15 % of the code can be damaged (scratches, dirt on a sticker) and it still scans.
  errorCorrectionLevel: 'M',
  // White border of 2 modules; the label itself adds more white space around it.
  margin: 2,
  // `ink` from 03-design-system: dark enough for every phone camera.
  color: { dark: '#243B3AFF', light: '#FFFFFFFF' },
};

// Returns the QR code as a data: URL, so the page can show it with <img src="…">.
// SVG stays sharp at any print size. helmet already allows data: images (app.js).
export async function qrDataUrl(text) {
  const svg = await QRCode.toString(text, QR_OPTIONS);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
