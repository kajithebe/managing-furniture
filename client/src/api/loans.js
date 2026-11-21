// Loans API (02 › API contract), student side.
import { api } from './client.js';

// S7 My loans: GET /api/loans/mine → { open, recent }.
// open: open loans sorted by dueAt; recent: the last 5 closed loans, newest first.
// Each loan: { id, status, reason, dueAt, createdAt, closedAt, toRoom: { id, name },
//   items: [{ id, status, code, name, category, condition, homeRoom, fromRoom }] }
export function getMyLoans(options) {
  return api.get('/loans/mine', options);
}

// S4 Send request: POST /api/loans { itemCodes, toRoomId, dueAt, reason } → the loan (same shape
// as above). The S6 Request sent page (MF-13) shows it. Errors: 02 › Borrow and decision errors.
export function createLoan(body) {
  return api.post('/loans', body);
}
