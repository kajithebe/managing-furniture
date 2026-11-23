import Table from '../../components/ui/Table.jsx';
import { formatClock } from '../requests/format.js';
import DashboardPanel, { ItemName } from './DashboardPanel.jsx';

// M1 "Due back today": items on loan that are due between now and midnight, soonest first
// (sorted by the API). Items that are already late are in "Not yet returned" instead.
// TODO: open the loan detail (M3) from a row once its page has a frontend route
// (needs team agreement: route and card).
const columns = [
  { key: 'item', header: 'Item', render: (row) => <ItemName row={row} /> },
  { key: 'borrower', header: 'Borrower', render: (row) => row.borrower.name },
  { key: 'due', header: 'Due', render: (row) => formatClock(row.dueAt) },
];

export default function DueTodayPanel({ rows }) {
  return (
    <DashboardPanel title="Due back today">
      <Table
        columns={columns}
        rows={rows}
        caption="Items due back today"
        emptyText="Nothing is due back today."
      />
    </DashboardPanel>
  );
}
