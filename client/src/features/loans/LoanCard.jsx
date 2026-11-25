import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { dueInfo, homeRoomNames, itemBadgeStatus, returnableItems } from './loanFormat.js';

// S7 My loans: one open loan.
// Title "In D751 · Group work", the due line, the home room(s), then one row per item,
// and "Return items" (MF-27) when the student still has at least one item of this loan.
// `now` is passed in by the page, so all cards use the same time.
export default function LoanCard({ loan, now }) {
  const navigate = useNavigate();
  const due = dueInfo(loan.dueAt, now);
  const homeRooms = homeRoomNames(loan.items);
  const title = loan.reason ? `In ${loan.toRoom.name} · ${loan.reason}` : `In ${loan.toRoom.name}`;
  const canReturn = returnableItems(loan.items).length > 0;

  return (
    <Card as="article">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>

      {due.kind === 'normal' ? (
        <p className="mt-3 text-[15px] font-semibold text-ink">{due.text}</p>
      ) : (
        <p role="status" className="mt-3 rounded-card bg-warn-bg px-4 py-3 text-sm text-warn">
          ! {due.text}
        </p>
      )}

      {homeRooms.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {homeRooms.length === 1 ? 'Home room' : 'Home rooms'}: {homeRooms.join(', ')}
        </p>
      )}

      <ul className="mt-2">
        {loan.items.map((item) => (
          <li key={item.id} className="border-b border-line py-4 last:border-b-0">
            <p className="text-[15px] text-ink">
              <span className="font-semibold">{item.name}</span>{' '}
              <span className="font-mono text-sm">{item.code}</span>
            </p>
            <Badge className="mt-2" status={itemBadgeStatus(item.status, loan.dueAt, now)} />
          </li>
        ))}
      </ul>

      {canReturn && (
        <Button fullWidth className="mt-2" onClick={() => navigate(`/return/${loan.id}`)}>
          Return items
        </Button>
      )}
    </Card>
  );
}
