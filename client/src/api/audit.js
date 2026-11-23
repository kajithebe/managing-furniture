// Audit log API for admins (02 › API contract, MF-24): GET /api/admin/audit.
import { api } from './client.js';
import { reportQuery } from './reports.js';

// View history: { entity, entityId, page } → { data, total }, newest first, 25 per page.
export function getAudit(params, options) {
  return api.get(`/admin/audit${reportQuery(params)}`, options);
}
