// Reports API (02 › API contract): GET /api/reports/inventory, and ?format=csv for the file.
import { ApiError, api } from './client.js';

// Turns the chosen filters into a query string. Empty filters ("All") are left out.
export function reportQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// M9 Inventory table: one page → { data, total }.
// params: { campus, building, room, category, status, sort, order, page }
export function getInventoryReport(params, options) {
  return api.get(`/reports/inventory${reportQuery(params)}`, options);
}

// M9 Not yet returned table (MF-23): one page → { data, total, notYetReturned }.
// params: { category, room, sort, order, page }
export function getOverdueReport(params, options) {
  return api.get(`/reports/overdue${reportQuery(params)}`, options);
}

// "Download CSV" of any report tab: the same filters and sort order, all matching rows (not
// only one page). The file is fetched first and then saved, so a refused request (401, 403)
// shows the API's message instead of an error page in the browser.
// report: the endpoint name, e.g. 'inventory' or 'overdue'.
async function downloadReportCsv(report, params) {
  // The page number is left out: the CSV has all rows.
  const filters = { ...params, page: undefined };

  let response;
  try {
    response = await fetch(`/api/reports/${report}${reportQuery({ ...filters, format: 'csv' })}`, {
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      data?.error?.code ?? 'HTTP_ERROR',
      data?.error?.message ?? 'Something went wrong. Please try again.',
    );
  }

  // The server names the file, e.g. inventory-2026-11-18.csv.
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? `${report}.csv`;

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Inventory tab: all items for the current filters and sort order.
export function downloadInventoryCsv(params) {
  return downloadReportCsv('inventory', params);
}

// Not yet returned tab: all late items for the current filters and sort order.
export function downloadOverdueCsv(params) {
  return downloadReportCsv('overdue', params);
}
