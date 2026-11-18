// Label data for the M8 "Print labels" page (02 › API contract, moderator).
// Each label comes with its QR code as a data: image (qrImage).
import { api } from './client.js';

// codes: ['MP-00123', …] → { data: [{ code, name, homeRoom, qrImage }] }
export function getItemLabels(codes, options) {
  return api.get(`/labels/items?codes=${encodeURIComponent(codes.join(','))}`, options);
}

// ids: [1, 2] → { data: [{ id, name, building, campus, qrImage }] }
export function getRoomLabels(ids, options) {
  return api.get(`/labels/rooms?ids=${encodeURIComponent(ids.join(','))}`, options);
}
