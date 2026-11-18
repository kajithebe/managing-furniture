import Card from '../../components/ui/Card.jsx';
import Table from '../../components/ui/Table.jsx';
import { formatClock, formatWaitingFor } from './format.js';

// One request on M2 Waiting: title line + table of the items still waiting.
export default function RequestCard({ request }) {
  const until = formatClock(request.dueAt);
  const titleId = `request-${request.id}-title`;

  const title = [
    request.borrower.name,
    `to ${request.toRoom.name}`,
    `until ${until}`,
    request.reason,
    `sent ${formatClock(request.createdAt)}`,
  ].join(' · ');

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (item) => (
        <>
          {item.name} <span className="font-mono">{item.code}</span>
        </>
      ),
    },
    { key: 'category', header: 'Category' },
    {
      key: 'route',
      header: 'From → To',
      render: (item) => `${item.fromRoom?.name ?? '—'} → ${request.toRoom.name}`,
    },
    { key: 'until', header: 'Until', render: () => until },
    { key: 'waitingFor', header: 'Waiting for', render: () => formatWaitingFor(request.createdAt) },
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
    </Card>
  );
}
