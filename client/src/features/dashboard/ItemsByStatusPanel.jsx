import { Link } from 'react-router-dom';
import DashboardPanel from './DashboardPanel.jsx';
import SortableTable from './SortableTable.jsx';

const numberFormat = new Intl.NumberFormat('en-US');

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// The status columns, in the order of the M1 design.
const STATUS_COLUMNS = [
  { key: 'available', header: 'Available' },
  { key: 'onLoan', header: 'On loan' },
  { key: 'needsRepair', header: 'Needs repair' },
  { key: 'broken', header: 'Broken' },
  { key: 'inRepair', header: 'In repair' },
  { key: 'disposed', header: 'Disposed' },
];

// M1 "Items by status": one row per category, in category order (from the API). The headers
// sort the rows in the browser. The category opens the Items list for it.
// TODO(MF-28): the Items page reads ?category= from the URL (needs team agreement with Abhinav).
const columns = [
  {
    key: 'category',
    header: 'Category',
    sortValue: (row) => row.category.name,
    render: (row) => (
      <Link
        to={`/mod/items?category=${encodeURIComponent(row.category.id)}`}
        className={`text-brand hover:underline ${focusRing}`}
      >
        {row.category.name}
      </Link>
    ),
  },
  ...STATUS_COLUMNS.map((column) => ({
    ...column,
    sortValue: (row) => row[column.key],
    render: (row) => numberFormat.format(row[column.key]),
  })),
];

export default function ItemsByStatusPanel({ rows }) {
  return (
    <DashboardPanel title="Items by status">
      <SortableTable
        columns={columns}
        // The Table needs an id per row: the category's id.
        rows={rows.map((row) => ({ ...row, id: row.category.id }))}
        caption="Number of items in each status, per category"
        emptyText="No categories yet."
      />
    </DashboardPanel>
  );
}
