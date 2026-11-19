import { useEffect, useState } from 'react';
import { getMyLoans } from '../api/loans.js';
import Button from '../components/ui/Button.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import LoanCard from '../features/loans/LoanCard.jsx';
import RecentLoanCard from '../features/loans/RecentLoanCard.jsx';

// The due lines ("30 min left", "Late since …") are refreshed once a minute.
const CLOCK_TICK_MS = 60 * 1000;

// Shared · Loading card list: two grey placeholder cards while the loans load.
function LoadingCards() {
  return (
    <div aria-busy="true" aria-label="Loading your loans" className="mt-4 space-y-4">
      {[1, 2].map((key) => (
        <div key={key} className="rounded-card border border-line bg-surface p-5">
          <div className="h-5 rounded bg-subtle" />
          <div className="mt-3 h-3 w-1/2 rounded bg-subtle" />
          <div className="mt-3 h-3 rounded bg-subtle" />
          <div className="mt-3 h-3 rounded bg-subtle" />
          <div className="mt-3 h-9 rounded bg-subtle" />
        </div>
      ))}
    </div>
  );
}

// S7 · My loans: the student's home page. Open loans first, then the last 5 closed.
export default function MyLoansPage() {
  // Counts "Try again" clicks; a new value loads the loans again.
  const [attempt, setAttempt] = useState(0);
  // The last answer from the API, together with the attempt it belongs to.
  const [result, setResult] = useState({ attempt: -1, open: [], recent: [], failed: false });
  const [now, setNow] = useState(() => new Date());

  const loading = result.attempt !== attempt;

  useEffect(() => {
    const controller = new AbortController();
    getMyLoans({ signal: controller.signal })
      .then(({ open, recent }) => {
        setNow(new Date());
        setResult({ attempt, open, recent, failed: false });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ attempt, open: [], recent: [], failed: true });
        }
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const noLoans = result.open.length === 0 && result.recent.length === 0;

  return (
    <>
      <h1 className="text-[28px] font-semibold text-ink">My loans</h1>

      {/* Opens the in-app scanner (step 7). */}
      <Button fullWidth className="mt-4">
        Scan an item
      </Button>

      {loading && <LoadingCards />}

      {!loading && result.failed && (
        <LoadError
          className="mt-4"
          message="Couldn't load your loans. Try again."
          text="Check your connection and try again."
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}

      {!loading && !result.failed && noLoans && (
        <p className="mt-4 flex gap-3 rounded-card bg-brand-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="font-semibold text-brand">
            i
          </span>
          <span>You have no loans. Scan the QR sticker on a chair or table to borrow it.</span>
        </p>
      )}

      {!loading && !result.failed && result.open.length > 0 && (
        <section aria-labelledby="open-loans" className="mt-6">
          <h2 id="open-loans" className="text-lg font-semibold text-ink">
            Open loans
          </h2>
          <div className="mt-3 space-y-4">
            {result.open.map((loan) => (
              <LoanCard key={loan.id} loan={loan} now={now} />
            ))}
          </div>
        </section>
      )}

      {!loading && !result.failed && result.recent.length > 0 && (
        <section aria-labelledby="recent-loans" className="mt-6">
          {result.open.length > 0 && (
            <a href="#open-loans" className="text-sm text-muted hover:text-ink">
              ↑ Open loans
            </a>
          )}
          <h2 id="recent-loans" className="mt-2 text-lg font-semibold text-ink">
            Recent loans
          </h2>
          <div className="mt-3 space-y-3">
            {result.recent.map((loan) => (
              <RecentLoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
