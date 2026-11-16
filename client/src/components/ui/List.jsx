export default function List({ items, renderItem, itemKey = 'id', className = '' }) {
  const classes = ['overflow-hidden rounded-card border border-line bg-surface', className]
    .filter(Boolean)
    .join(' ');

  return (
    <ul className={classes}>
      {items.map((item) => (
        <li key={item[itemKey]} className="border-t border-line px-5 py-4 first:border-t-0">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
