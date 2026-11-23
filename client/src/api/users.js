// Users API for admins (02 › API contract, MF-24): GET and POST /api/admin/users.
import { api } from './client.js';
import { reportQuery } from './reports.js';

// A2 table: one page → { data, total, activeAdmins }.
// params: { q, role, status, sort, order, page, pageSize }; empty filters ("All") are left out.
export function getUsers(params, options) {
  return api.get(`/admin/users${reportQuery(params)}`, options);
}

// P14 Add user: { email, name, role } → 201 with the new row.
export function addUser(body) {
  return api.post('/admin/users', body);
}
