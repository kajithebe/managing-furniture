import { formatClock } from '../requests/format.js';
import DashboardPanel, { ItemName } from './DashboardPanel.jsx';
import SortableTable from './SortableTable.jsx';
import { byBorrower, byItem, byTime } from './sortValues.js';

// M1 "Waiting for approval": the 5 oldest waiting items, oldest first (sorted by the API).
// The headers sort these 5 rows in the browser.
const columns = [
  { key: 'item', header: 'Item', sortValue: byItem, render: (row) => <ItemName row={row} /> },
  {
    key: 'borrower',
    header: 'Requested by',
    sortValue: byBorrower,
    render: (row) => row.borrower.name,
  },
  {
    key: 'to',
    header: 'To',
    sortValue: (row) => row.toRoom?.name,
    render: (row) => row.toRoom?.name ?? '—',
  },
  {
    key: 'until',
    header: 'Until',
    sortValue: (row) => byTime(row.dueAt),
    render: (row) => formatClock(row.dueAt),
  },
];

export default function WaitingPanel({ rows }) {
  return (
    <DashboardPanel
      title="Waiting for approval"
      link={{ to: '/mod/requests', label: 'See all requests →' }}
    >
      <SortableTable
        columns={columns}
        rows={rows}
        caption="5 oldest items waiting for approval"
        emptyText="No requests waiting. Nice!"
      />
    </DashboardPanel>
  );
}
