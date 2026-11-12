export default function App() {
  return (
    <main className="p-5">
      <div className="rounded-card border border-line bg-surface p-5">
        <h1 className="text-[28px] font-semibold">Managing Furniture</h1>
        <p className="mt-2 text-muted">Design tokens and fonts are working.</p>
        <p className="mt-2 font-mono text-sm text-muted">MP-00123</p>
        <span className="mt-4 inline-block rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand">
          Available
        </span>
        <button
          type="button"
          className="mt-4 h-11 w-full rounded bg-brand font-semibold text-white hover:bg-brand-hover"
        >
          Borrow
        </button>
      </div>
    </main>
  );
}
