// Items API (02 › API contract).
import { api } from './client.js';

// GET /api/items/:code → one item with its category rule, brand, colour, home and current
// room, shown status, borrowable and currentLoan. Any logged-in user (the page a QR scan opens).
export function getItem(code, options) {
  return api.get(`/items/${encodeURIComponent(code)}`, options);
}

// M5 Items list (moderator): GET /api/items → { data, total }.
// params: { q, category, campus, building, room, status, showDisposed, sort, order, page, pageSize }
// Empty filters ("All", toggle off) are left out, so the server uses its defaults.
export function listItems(params, options) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return api.get(`/items${text ? `?${text}` : ''}`, options);
}

// M6 Add item: POST /api/items with quantity 1–200 → always an array of the created items.
export function createItems(body, options) {
  return api.post('/items', body, options);
}

// M6 code preview: GET /api/items/next-code → { first, last } (the same code when quantity is 1).
// The other values are for the code scheme (MF-21): campus, category … can be part of the code.
export function getNextCodes(params, options) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, String(value));
  }
  return api.get(`/items/next-code?${search}`, options);
}
