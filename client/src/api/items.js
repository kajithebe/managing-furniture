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

// M6 Edit: PATCH /api/items/:code → the item. Only details: category, name, brand, colour,
// wheels, notes and both rooms (a room change needs a reason). The code never changes;
// status has its own action on the item page (MF-29).
export function updateItem(code, body, options) {
  return api.patch(`/items/${encodeURIComponent(code)}`, body, options);
}

// M7 item actions (MF-29), each with a reason (1–500 characters) and returning the item.
// Change status: PATCH /api/items/:code/status { condition, reason }. Blocked while on loan.
export function changeItemStatus(code, body, options) {
  return api.patch(`/items/${encodeURIComponent(code)}/status`, body, options);
}

// Correct location: PATCH /api/items/:code/location { currentRoomId, reason }. Blocked while on loan.
export function correctItemLocation(code, body, options) {
  return api.patch(`/items/${encodeURIComponent(code)}/location`, body, options);
}

// Change home room: PATCH /api/items/:code/home { homeRoomId, reason }.
export function changeItemHome(code, body, options) {
  return api.patch(`/items/${encodeURIComponent(code)}/home`, body, options);
}
