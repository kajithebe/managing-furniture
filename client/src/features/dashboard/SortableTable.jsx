import { useState } from 'react';
import SortButton from '../../components/ui/SortButton.jsx';
import Table from '../../components/ui/Table.jsx';

// "Table MP-00126" before "Table MP-02210": numbers inside text sort as numbers.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a ?? ''), String(b ?? ''));
}

// A dashboard table with the sort arrows of M1 (↕ ↑ ↓) on every column header.
// The rows are sorted in the browser: the dashboard already has all of them, so a click never
// calls the API again. Before the first click the rows keep the order the API sends.
// Each column needs sortValue(row): a number (counts, times) or a text (names, rooms).
export default function SortableTable({ columns, rows, ...tableProps }) {
  const [sort, setSort] = useState({ column: null, order: 'asc' });

  // Same behaviour as the Inventory report: a new column sorts A–Z, the same column again Z–A.
  function changeSort(key) {
    setSort((current) =>
      current.column === key
        ? { column: key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { column: key, order: 'asc' },
    );
  }

  const sortColumn = columns.find((column) => column.key === sort.column);
  const direction = sort.order === 'asc' ? 1 : -1;
  // Array.sort is stable, so rows with the same value keep the API order.
  const sortedRows = sortColumn
    ? [...rows].sort(
        (a, b) => direction * compare(sortColumn.sortValue(a), sortColumn.sortValue(b)),
      )
    : rows;

  const headerColumns = columns.map((column) => ({
    ...column,
    header: (
      <SortButton
        column={{ key: column.key, label: column.header }}
        sort={sort}
        onSort={changeSort}
      />
    ),
  }));

  return <Table columns={headerColumns} rows={sortedRows} {...tableProps} />;
}
