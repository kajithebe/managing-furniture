import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import { requestSummary } from '../features/loans/loanFormat.js';

// S6 · Request sent: shown after a borrow request (MF-12) was sent.
// The borrow form passes the loan from POST /api/loans in the router state:
//   navigate('/borrow/sent', { state: { loan } })
// Opened without it (refresh, typed URL), there is nothing to show, so go to My loans.
export default function RequestSentPage() {
  const loan = useLocation().state?.loan;
  const navigate = useNavigate();

  if (!loan?.items) {
    return <Navigate to="/loans" replace />;
  }

  const { approvedText, waitingText } = requestSummary(loan);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-semibold text-ink">Request sent</h1>
      <p aria-hidden="true" className="mt-4 text-5xl leading-none text-brand">
        ✓
      </p>

      {approvedText && (
        <p className="mt-6 flex gap-3 rounded-card bg-brand-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="font-semibold text-brand">
            ✓
          </span>
          <span>{approvedText}</span>
        </p>
      )}

      {waitingText && (
        <p className="mt-4 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-sm text-warn">
          <span aria-hidden="true" className="font-semibold">
            !
          </span>
          <span>{waitingText}</span>
        </p>
      )}

      <div className="-mx-5 -mb-5 mt-auto border-t border-line bg-surface p-5">
        <Button fullWidth onClick={() => navigate('/loans')}>
          Go to my loans
        </Button>
      </div>
    </div>
  );
}
