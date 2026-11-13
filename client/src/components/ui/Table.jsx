export default function Table({
  columns,
  rows,
  rowKey = 'id',
  caption,
  emptyText = 'Nothing to show.',
  className = '',
}) {
  const wrapperClasses = ['overflow-x-auto rounded-card border border-line bg-surface', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses}>
      <table className="w-full border-collapse text-left text-sm text-ink">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-subtle-2">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-4 py-3 text-xs font-semibold text-muted"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row[rowKey]} className="border-t border-line">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-middle">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}