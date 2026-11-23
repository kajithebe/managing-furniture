// What the dashboard tables sort by (used as sortValue in SortableTable columns).
// Kept out of SortableTable.jsx, because a component file should only export components.
export const byItem = (row) => `${row.name} ${row.code}`;
export const byBorrower = (row) => row.borrower.name;
export const byTime = (value) => new Date(value).getTime();
