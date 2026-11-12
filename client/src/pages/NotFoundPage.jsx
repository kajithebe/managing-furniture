import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="p-5">
      <div className="rounded-card border border-line bg-surface p-5">
        <h1 className="text-[28px] font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">This address does not exist.</p>
        <Link to="/loans" className="mt-4 inline-block font-semibold text-brand">
          Open my loans
        </Link>
      </div>
    </main>
  );
}
