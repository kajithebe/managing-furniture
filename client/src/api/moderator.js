import { api } from './client.js';

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
