import { api } from './client.js';

// M2 Requests, see 02 › "Moderator request and loan shapes".
export function getWaitingRequests(options) {
  return api.get('/moderator/requests?tab=waiting', options);
}

// Approve one waiting item (a LoanItem id from request.waiting[].id).
export function approveLoanItem(loanItemId) {
  return api.post(`/moderator/loan-items/${encodeURIComponent(loanItemId)}/approve`, {});
}
