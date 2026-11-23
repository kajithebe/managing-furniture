import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// One white block on M1 ("Waiting for approval", "Not yet returned" …): a heading, the content,
// and an optional link at the bottom ("See all requests →").
export default function DashboardPanel({ title, link, children }) {
  const headingId = `dashboard-${title.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <Card as="section" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
      {link && (
        <Link
          to={link.to}
          className={`mt-4 inline-block text-[13px] text-brand hover:underline ${focusRing}`}
        >
          {link.label}
        </Link>
      )}
    </Card>
  );
}

// "Table MP-02210": the item name with the code in the code font, as on M2.
export function ItemName({ row }) {
  return (
    <>
      {row.name} <span className="whitespace-nowrap font-mono">{row.code}</span>
    </>
  );
}
