import { useEffect, useState } from 'react';
import { getAudit } from '../../api/audit.js';
import Pagination from '../reports/Pagination.jsx';
import { formatDateTime } from '../requests/format.js';
import { historyText } from './userText.js';

const PAGE_SIZE = 25;

// A2 "View history": the AuditLog rows of one user, newest first, inside the A2 panel.
// reloadKey: a new value loads the list again (after a role or status change).
export default function UserHistory({ userId, reloadKey }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ key: '', data: [], total: 0, failed: false });
  const key = `${userId}-${page}-${reloadKey}`;
  const loading = result.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    getAudit({ entity: 'User', entityId: userId, page }, { signal: controller.signal })
      .then(({ data, total }) => setResult({ key, data, total, failed: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ key, data: [], total: 0, failed: true });
        }
      });
    return () => controller.abort();
  }, [userId, page, key]);

  let content;
  if (loading) {
    content = <p className="text-sm text-muted">Loading…</p>;
  } else if (result.failed) {
    content = (
      <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
        ! Couldn&apos;t load the history. Try again.
      </p>
    );
  } else if (result.data.length === 0) {
    content = <p className="text-sm text-muted">No changes yet.</p>;
  } else {
    content = (
      <>
        <ul className="divide-y divide-line rounded-card border border-line">
          {result.data.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-ink">{historyText(entry)}</span>
              <span className="whitespace-nowrap text-muted">
                {formatDateTime(entry.createdAt)} · by {entry.actor.name ?? '—'}
              </span>
            </li>
          ))}
        </ul>
        <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} onPageChange={setPage} />
      </>
    );
  }

  return (
    <section id="user-history" aria-labelledby="user-history-title" className="mt-6">
      <h3 id="user-history-title" className="text-sm font-semibold text-ink">
        History
      </h3>
      <div className="mt-2">{content}</div>
    </section>
  );
}
