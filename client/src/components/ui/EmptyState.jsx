export default function EmptyState({ title, text, action, className = '' }) {
  const classes = ['rounded-card border border-line bg-surface p-5 text-center', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
