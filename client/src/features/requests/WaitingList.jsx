import { useEffect, useState } from 'react';
import { getWaitingRequests } from '../../api/moderator.js';
import LoadError from '../../components/ui/LoadError.jsx';
import RequestCard from './RequestCard.jsx';

// M2 Waiting tab. Oldest request first (sorted by the API).
export default function WaitingList() {
  const [state, setState] = useState({ status: 'loading', requests: [] });
  // Changing this number loads the list again ("Try again").
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getWaitingRequests({ signal: controller.signal })
      .then((result) => setState({ status: 'ready', requests: result.data }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', requests: [] });
      });

    // Leaving the tab cancels the request, so no state update after unmount.
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: 'loading', requests: [] });
    setAttempt((value) => value + 1);
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <LoadError
        message="Couldn't load requests. Try again."
        text="We couldn't load this list."
        onRetry={retry}
      />
    );
  }

  if (state.requests.length === 0) {
    // Page 19: empty Requests.
    return (
      <div className="py-12 text-center">
        <p aria-hidden="true" className="text-3xl text-brand">
          ✓
        </p>
        <p className="mt-2 text-lg font-semibold text-ink">No requests waiting. Nice!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
