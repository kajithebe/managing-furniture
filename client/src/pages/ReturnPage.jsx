import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMyLoans } from '../api/loans.js';
import Button from '../components/ui/Button.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import { returnableItems } from '../features/loans/loanFormat.js';
import ReturnRoomStep from '../features/return/ReturnRoomStep.jsx';
import ReturnStep from '../features/return/ReturnStep.jsx';

const TITLE = 'Return items';

// S8–S10 · Return items (MF-27), opened from "Return items" on My loans: /return/:loanId.
// Students have no GET /loans/:id, so the loan is taken from GET /loans/mine (02 › Loan shape).
// Another user's loan is never in that list, so it shows "nothing to return" like a closed one.
export default function ReturnPage() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  // Counts "Try again" clicks; a new value (or another loan id) loads the loan again.
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${loanId}#${attempt}`;
  const [result, setResult] = useState({ key: null, loan: null, failed: false });

  const loading = result.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    getMyLoans({ signal: controller.signal })
      .then(({ open, recent }) => {
        const loan = [...open, ...recent].find((entry) => String(entry.id) === loanId) ?? null;
        setResult({ key: requestKey, loan, failed: false });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ key: requestKey, loan: null, failed: true });
        }
      });
    return () => controller.abort();
  }, [requestKey, loanId]);

  const backToLoans = () => navigate('/loans');

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (result.failed) {
    return (
      <ReturnStep title={TITLE}>
        <LoadError
          phone
          className="mt-4"
          message="Couldn't load your loan."
          onRetry={() => setAttempt((value) => value + 1)}
        />
      </ReturnStep>
    );
  }

  const { loan } = result;
  if (!loan || loan.status === 'CLOSED' || returnableItems(loan.items).length === 0) {
    return (
      <ReturnStep title={TITLE}>
        <p className="mt-3 text-[15px] text-ink">There is nothing to return in this loan.</p>
        <Button fullWidth className="mt-5" onClick={backToLoans}>
          Back to my loans
        </Button>
      </ReturnStep>
    );
  }

  return <ReturnRoomStep loan={loan} onBack={backToLoans} />;
}
