import { api } from './client.js';

// M2 Requests, see 02 › "Moderator request and loan shapes".
export function getWaitingRequests(options) {
  return api.get('/moderator/requests?tab=waiting', options);
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
