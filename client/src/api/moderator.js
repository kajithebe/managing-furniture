import { api } from './client.js';
import { reportQuery } from './reports.js';

// M2 Requests, see 02 › "Moderator request and loan shapes".
export function getWaitingRequests(options) {
  return api.get('/moderator/requests?tab=waiting', options);
}

// M2 Decided today: items decided by a moderator since midnight, 25 per page, newest first.
export function getDecidedToday(page, options) {
  const params = new URLSearchParams({ tab: 'decided', page: String(page) });
  return api.get(`/moderator/requests?${params}`, options);
}

// Approve one waiting item (a LoanItem id from request.waiting[].id).
export function approveLoanItem(loanItemId) {
  return api.post(`/moderator/loan-items/${encodeURIComponent(loanItemId)}/approve`, {});
}

// Decline one waiting item; the note (max 500) goes to the borrower in the decision email.
export function declineLoanItem(loanItemId, note) {
  return api.post(
    `/moderator/loan-items/${encodeURIComponent(loanItemId)}/decline`,
    note ? { note } : {},
  );
}

// M1 Dashboard: tiles, lists, items by status and recent activity in one call (MF-31).
export function getDashboard(options) {
  return api.get('/moderator/dashboard', options);
}

// M4 Not yet returned (MF-23): one page → { data, total, notYetReturned }.
// params: { category, room, sort, order, page, pageSize }; empty filters ("All") are left out.
export function getOverdue(params, options) {
  return api.get(`/moderator/overdue${reportQuery(params)}`, options);
}

// P12 Mark returned (MF-23): a moderator confirms one item is back in its home room.
// The note is optional (max 500) and goes into the item's history.
// → { id, status, code, name, category, returnedAt, returnMethod, returnedBy, note, loan }
export function markLoanItemReturned(loanItemId, note) {
  return api.post(
    `/moderator/loan-items/${encodeURIComponent(loanItemId)}/mark-returned`,
    note ? { note } : {},
  );
}

// P11 Email borrower (MF-23): the read-only preview → { to, subject, message }.
export function getContactPreview(loanItemId, options) {
  return api.get(`/moderator/loan-items/${encodeURIComponent(loanItemId)}/contact`, options);
}

// P11 "Send email": emails the borrower and saves Last contacted → { id, lastContactedAt }.
export function contactBorrower(loanItemId) {
  return api.post(`/moderator/loan-items/${encodeURIComponent(loanItemId)}/contact`, {});
}
