import { Link } from 'react-router-dom';

export default function Tile({ label, value, to, className = '' }) {
  const classes = [
    'block rounded-card border border-line bg-surface p-5',
    'hover:bg-page',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link to={to} className={classes}>
      <span className="block text-[13px] text-muted">{label}</span>
      <span className="mt-1 block text-[32px] font-semibold leading-tight text-ink">{value}</span>
    </Link>
  );
}