import { useEffect, useState } from 'react';
import { getWaitingRequests } from '../../api/moderator.js';
import LoadError from '../../components/ui/LoadError.jsx';
import Toast from '../../components/ui/Toast.jsx';
import RequestCard from './RequestCard.jsx';

// M2 Waiting tab. Oldest request first (sorted by the API).
export default function WaitingList() {
  const [state, setState] = useState({ status: 'loading', requests: [] });
  // Changing this number loads the list again ("Try again", or after a decision).
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState('');

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

  // "Try again": show Loading… while the list loads again.
  function retry() {
    setState({ status: 'loading', requests: [] });
    setAttempt((value) => value + 1);
  }

  // After approve or decline: keep the current list on screen and swap it when the new one arrives.
  function handleDecided(item, decision) {
    setToast(`${item.name} ${item.code} ${decision}`);
    setAttempt((value) => value + 1);
  }

  let content;
  if (state.status === 'loading') {
    content = (
      <p role="status" className="text-sm text-muted">
        Loading…
      </p>
    );
  } else if (state.status === 'error') {
    content = (
      <LoadError
        message="Couldn't load requests. Try again."
        text="We couldn't load this list."
        onRetry={retry}
      />
    );
  } else if (state.requests.length === 0) {
    // Page 19: empty Requests.
    content = (
      <div className="py-12 text-center">
        <p aria-hidden="true" className="text-3xl text-brand">
          ✓
        </p>
        <p className="mt-2 text-lg font-semibold text-ink">No requests waiting. Nice!</p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-4">
        {state.requests.map((request) => (
          <RequestCard key={request.id} request={request} onDecided={handleDecided} />
        ))}
      </div>
    );
  }

  return (
    <>
      {content}
      {/* 03: the toast appears under the list. */}
      <Toast className="mt-4" message={toast} onDismiss={() => setToast('')} />
    </>
  );
}
