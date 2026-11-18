import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDecidedToday } from '../../api/moderator.js';
import Badge from '../../components/ui/Badge.jsx';
import LoadError from '../../components/ui/LoadError.jsx';
import Table from '../../components/ui/Table.jsx';
// TODO: move Pagination to components/ui (shared with Reports, needs team agreement).
import Pagination from '../reports/Pagination.jsx';
import { formatDateTime } from './format.js';

const PAGE_SIZE = 25; // 02: Decided today returns 25 per page.

const columns = [
  {
    key: 'item',
    header: 'Item',
    render: (row) => (
      <>
        {row.name} <span className="whitespace-nowrap font-mono">{row.code}</span>
      </>
    ),
  },
  {
    key: 'request',
    header: 'Request',
    render: (row) => `${row.loan.borrower.name} · ${row.loan.toRoom.name}`,
  },
  {
    key: 'decision',
    header: 'Decision',
    render: (row) => <Badge status={row.decision === 'APPROVED' ? 'approved' : 'declined'} />,
  },
  { key: 'decidedBy', header: 'Decided by', render: (row) => row.decidedBy?.name ?? '—' },
  {
    key: 'when',
    header: 'When',
    render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.decidedAt)}</span>,
  },
];

// M2 Decided today tab: one row per decided item, with paging. The page is in the URL.
export default function DecidedList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  // Changing this number loads the page again ("Try again").
  const [attempt, setAttempt] = useState(0);
  // The result remembers which page/attempt it belongs to, so a new page shows Loading…
  const [result, setResult] = useState(null);
  const key = `${page}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    getDecidedToday(page, { signal: controller.signal })
      .then((data) => setResult({ key, status: 'ready', rows: data.data, total: data.total }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResult({ key, status: 'error' });
      });

    return () => controller.abort();
  }, [key, page]);

  function goToPage(number) {
    setSearchParams({ tab: 'decided', page: String(number) });
  }

  const current = result?.key === key ? result : null;

  if (!current) {
    return (
      <p role="status" className="text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (current.status === 'error') {
    return (
      <LoadError
        message="Couldn't load requests. Try again."
        text="We couldn't load this list."
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  return (
    <Table
      columns={columns}
      rows={current.rows}
      caption="Items decided today"
      footer={
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={current.total}
          onPageChange={goToPage}
        />
      }
    />
  );
}
