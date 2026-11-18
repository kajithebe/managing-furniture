import { useState } from 'react';
import { approveLoanItem } from '../../api/moderator.js';
import Badge from '../../components/ui/Badge.jsx';
import Card from '../../components/ui/Card.jsx';
import Table from '../../components/ui/Table.jsx';
import { formatClock, formatWaitingFor } from './format.js';

const linkButton =
  'font-semibold text-brand disabled:cursor-not-allowed disabled:text-muted ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function ItemLabel({ item }) {
  return (
    <>
      {item.name} <span className="whitespace-nowrap font-mono">{item.code}</span>
    </>
  );
}

// One request on M2 Waiting: title line, table of the items still waiting (with actions),
// and the items already approved in the same request (shown as info).
export default function RequestCard({ request, onApproved }) {
  // LoanItem id that is being sent; blocks a second click while the call runs.
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const until = formatClock(request.dueAt);
  const titleId = `request-${request.id}-title`;
  const route = (item) => `${item.fromRoom?.name ?? '—'} → ${request.toRoom.name}`;

  async function approve(item) {
    setBusyId(item.id);
    setError('');
    try {
      await approveLoanItem(item.id);
      onApproved(item);
    } catch (err) {
      // e.g. ALREADY_DECIDED or ITEM_NOT_AVAILABLE: show the API's message as it is (02).
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const title = [
    request.borrower.name,
    `to ${request.toRoom.name}`,
    `until ${until}`,
    request.reason,
    `sent ${formatClock(request.createdAt)}`,
  ].join(' · ');

  const columns = [
    { key: 'item', header: 'Item', render: (item) => <ItemLabel item={item} /> },
    { key: 'category', header: 'Category' },
    {
      key: 'route',
      header: 'From → To',
      render: (item) => <span className="whitespace-nowrap">{route(item)}</span>,
    },
    { key: 'until', header: 'Until', render: () => until },
    { key: 'waitingFor', header: 'Waiting for', render: () => formatWaitingFor(request.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <button
          type="button"
          className={linkButton}
          disabled={busyId !== null}
          aria-label={`Approve ${item.name} ${item.code}`}
          onClick={() => approve(item)}
        >
          Approve
        </button>
      ),
    },
  ];

  return (
    <Card as="article" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-base font-semibold text-ink">
        {title}
      </h2>
      <Table
        className="mt-4"
        columns={columns}
        rows={request.waiting}
        caption={`Items waiting for approval, requested by ${request.borrower.name}`}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          ! {error}
        </p>
      )}

      {request.approved.length > 0 && (
        <section aria-labelledby={`${titleId}-approved`} className="mt-4">
          <h3 id={`${titleId}-approved`} className="text-xs text-muted">
            Already approved in this request
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {request.approved.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 text-sm text-ink"
              >
                <span>
                  <ItemLabel item={item} /> · {route(item)} · until {until}
                </span>
                {/* Auto-approved by category, or approved by a moderator earlier. */}
                <Badge status={item.autoApproved ? 'autoApproved' : 'approved'} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
