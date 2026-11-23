import Table from '../../components/ui/Table.jsx';
import DashboardPanel, { ItemName } from './DashboardPanel.jsx';
import { formatDayClock, formatLate } from './format.js';

// M1 "Not yet returned": the 5 items that are late the longest (sorted by the API).
// "Last room" is where the item was last seen: its current room.
function columnsFor(now) {
  return [
    { key: 'item', header: 'Item', render: (row) => <ItemName row={row} /> },
    { key: 'borrower', header: 'Borrower', render: (row) => row.borrower.name },
    {
      key: 'due',
      header: 'Due / late',
      render: (row) => (
        <>
          <span className="block">{formatLate(row.dueAt, now)}</span>
          <span className="block whitespace-nowrap text-muted">{formatDayClock(row.dueAt)}</span>
        </>
      ),
    },
    { key: 'lastRoom', header: 'Last room', render: (row) => row.lastRoom?.name ?? '—' },
  ];
}

export default function OverduePanel({ rows, now }) {
  return (
    <DashboardPanel title="Not yet returned" link={{ to: '/mod/overdue', label: 'See all →' }}>
      <Table
        columns={columnsFor(now)}
        rows={rows}
        caption="5 items that are late the longest"
        emptyText="Everything is back where it belongs."
      />
    </DashboardPanel>
  );
}
