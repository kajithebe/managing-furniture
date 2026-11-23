import DashboardPanel, { ItemName } from './DashboardPanel.jsx';
import SortableTable from './SortableTable.jsx';
import { byBorrower, byItem, byTime } from './sortValues.js';
import { formatDayClock, formatLate } from './format.js';

// M1 "Not yet returned": the 5 items that are late the longest, longest first (sorted by the
// API). The headers sort these 5 rows in the browser; "Due / late" sorts by the until-time.
// "Last room" is where the item was last seen: its current room.
function columnsFor(now) {
  return [
    { key: 'item', header: 'Item', sortValue: byItem, render: (row) => <ItemName row={row} /> },
    {
      key: 'borrower',
      header: 'Borrower',
      sortValue: byBorrower,
      render: (row) => row.borrower.name,
    },
    {
      key: 'due',
      header: 'Due / late',
      sortValue: (row) => byTime(row.dueAt),
      render: (row) => (
        <>
          <span className="block">{formatLate(row.dueAt, now)}</span>
          <span className="block whitespace-nowrap text-muted">{formatDayClock(row.dueAt)}</span>
        </>
      ),
    },
    {
      key: 'lastRoom',
      header: 'Last room',
      sortValue: (row) => row.lastRoom?.name,
      render: (row) => row.lastRoom?.name ?? '—',
    },
  ];
}

export default function OverduePanel({ rows, now }) {
  return (
    <DashboardPanel title="Not yet returned" link={{ to: '/mod/overdue', label: 'See all →' }}>
      <SortableTable
        columns={columnsFor(now)}
        rows={rows}
        caption="5 items that are late the longest"
        emptyText="Everything is back where it belongs."
      />
    </DashboardPanel>
  );
}
