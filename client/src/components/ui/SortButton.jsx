// Column header with the sort arrow (M9, A2): ↕ not sorted, ↑ A–Z, ↓ Z–A.
// column: { key, label }; sort: { column, order }; onSort(key) is called on click.
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default function SortButton({ column, sort, onSort }) {
  const active = sort.column === column.key;
  const arrow = active ? (sort.order === 'asc' ? '↑' : '↓') : '↕';
  const state = active ? (sort.order === 'asc' ? ', sorted A to Z' : ', sorted Z to A') : '';

  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      aria-label={`Sort by ${column.label}${state}`}
      className={`inline-flex items-center gap-1 rounded ${focusRing} ${active ? 'text-ink' : ''}`}
    >
      {column.label}
      <span aria-hidden="true">{arrow}</span>
    </button>
  );
}
