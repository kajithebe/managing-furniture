// Lookups API (02 › API contract): GET /api/lookups → all dropdown lists in one call:
// { categories, brands, colours, campuses: [{ …, buildings: [{ …, rooms: [...] }] }] }.
// Non-archived entries only, sorted by name.
import { api } from './client.js';

export function getLookups(options) {
  return api.get('/lookups', options);
}

// "+ Add new" (P1–P6, moderator): POST /api/categories · /brands · /colours · /campuses ·
// /buildings · /rooms → the created entry. A name or short code that is taken gives 409
// DUPLICATE_NAME (with `existing`, for the "Use Chair" button) or DUPLICATE_CODE.
const ENTRY_PATHS = {
  category: '/categories',
  brand: '/brands',
  colour: '/colours',
  campus: '/campuses',
  building: '/buildings',
  room: '/rooms',
};

export function createLookupEntry(kind, body, options) {
  return api.post(ENTRY_PATHS[kind], body, options);
}

// Short code suggestion for a name: list is category, brand, colour or campus → { code }.
export function suggestShortCode(list, name, options) {
  const search = new URLSearchParams({ list, name });
  return api.get(`/lookups/suggest-code?${search}`, options);
}
