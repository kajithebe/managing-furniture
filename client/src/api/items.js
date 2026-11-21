// Items API (02 › API contract).
// GET /api/items/:code → one item with its category rule, brand, colour, home and current
// room, shown status, borrowable and currentLoan. Any logged-in user (the page a QR scan opens).
import { api } from './client.js';

export function getItem(code, options) {
  return api.get(`/items/${encodeURIComponent(code)}`, options);
}
