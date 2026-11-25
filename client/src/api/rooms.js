// Rooms API (02 › API contract), student side.
import { api } from './client.js';

// S8 Return step 1: GET /api/rooms/by-qr/:qrToken → { id, name, building: { id, name }, campus: { id, name } }.
// The token comes from a scanned door label (BASE_URL/r/<qrToken>); the reply never contains it.
// Unknown token → 404 ROOM_NOT_FOUND "Room not found."
export function getRoomByQr(qrToken, options) {
  return api.get(`/rooms/by-qr/${encodeURIComponent(qrToken)}`, options);
}
