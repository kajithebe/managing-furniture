// Lookups API (02 › API contract): GET /api/lookups → all dropdown lists in one call:
// { categories, brands, colours, campuses: [{ …, buildings: [{ …, rooms: [...] }] }] }.
// Non-archived entries only, sorted by name.
import { api } from './client.js';

export function getLookups(options) {
  return api.get('/lookups', options);
}
