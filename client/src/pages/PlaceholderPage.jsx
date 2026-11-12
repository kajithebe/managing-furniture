import { useLocation } from 'react-router-dom';

export default function PlaceholderPage({ title }) {
  const { pathname } = useLocation();

  return (
    <main className="p-5">
      <div className="rounded-card border border-line bg-surface p-5">
        <h1 className="text-[28px] font-semibold">{title}</h1>
        <p className="mt-2 font-mono text-sm text-muted">{pathname}</p>
        <p className="mt-2 text-muted">This page is not built yet.</p>
      </div>
    </main>
  );
}
