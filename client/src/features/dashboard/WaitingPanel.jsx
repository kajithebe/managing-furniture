import Table from '../../components/ui/Table.jsx';
import { formatClock } from '../requests/format.js';
import DashboardPanel, { ItemName } from './DashboardPanel.jsx';

// M1 "Waiting for approval": the 5 oldest waiting items (sorted by the API).
const columns = [
  { key: 'item', header: 'Item', render: (row) => <ItemName row={row} /> },
  { key: 'borrower', header: 'Requested by', render: (row) => row.borrower.name },
  { key: 'to', header: 'To', render: (row) => row.toRoom?.name ?? '—' },
  { key: 'until', header: 'Until', render: (row) => formatClock(row.dueAt) },
];

export default function WaitingPanel({ rows }) {
  return (
    <DashboardPanel
      title="Waiting for approval"
      link={{ to: '/mod/requests', label: 'See all requests →' }}
    >
      <Table
        columns={columns}
        rows={rows}
        caption="5 oldest items waiting for approval"
        emptyText="No requests waiting. Nice!"
      />
    </DashboardPanel>
  );
}
