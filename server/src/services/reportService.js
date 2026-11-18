// Reports (01 › Reports, M9 in design-screens). Each report is a filtered table with a
// Download CSV button. Sprint 1 has the Inventory report; the other tabs come in Sprint 2.
import { toCsv } from '../utils/csv.js';
import { listItems } from './itemService.js';

// The CSV holds every matching item, not only one page. 01 expects about 10,000 items at
// Karaportti, so this limit leaves room to grow while keeping one download reasonable.
export const INVENTORY_CSV_MAX_ROWS = 20000;

// Status words as on the badges (03 › Item status badges).
const STATUS_LABELS = {
  AVAILABLE: 'Available',
  ON_LOAN: 'On loan',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// The M9 columns, in the same order as on the screen.
const inventoryColumns = [
  { header: 'Code', value: (item) => item.code },
  { header: 'Category', value: (item) => item.category.name },
  { header: 'Name', value: (item) => item.name },
  { header: 'Brand', value: (item) => item.brand?.name },
  { header: 'Colour', value: (item) => item.colour?.name },
  // "No", or the number of wheels, as on M9.
  { header: 'Wheels', value: (item) => (item.hasWheels ? item.wheelCount : 'No') },
  { header: 'Home room', value: (item) => item.homeRoom.name },
  { header: 'Current room', value: (item) => item.currentRoom.name },
  { header: 'Status', value: (item) => STATUS_LABELS[item.status] },
];

// The report uses the same filters, sorting and status rules as the Items list (MF-08), so a
// filter gives the same items in both places. Disposed items are left out unless the Status
// filter is Disposed. Search is not part of this report.
function inventoryQuery(filters) {
  return { ...filters, showDisposed: false, q: undefined };
}

// GET /api/reports/inventory → { data, total } for one page of the table.
// filters: { category, campus, building, room, status, sort, order, page, pageSize },
// already validated by the route.
export function inventoryReport(filters) {
  return listItems(inventoryQuery(filters));
}

// GET /api/reports/inventory?format=csv → the CSV file as text, with all matching items
// in the chosen sort order.
export async function inventoryCsv(filters) {
  const { data } = await listItems({
    ...inventoryQuery(filters),
    page: 1,
    pageSize: INVENTORY_CSV_MAX_ROWS,
  });
  return toCsv(inventoryColumns, data);
}
