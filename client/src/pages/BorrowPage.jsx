import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { clearDraft, removeDraftItem, useBorrowDraft } from '../features/borrow/borrowDraft.js';

// S4 · Borrow request: the items of one request, each tagged auto-approved / needs approval.
// Room, until time, reason and sending follow in the next steps of MF-12.

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function itemsText(count) {
  return count === 1 ? '1 item' : `${count} items`;
}

// "4 items will be approved now. 1 item needs a moderator's approval."
function summaryText(items) {
  const approved = items.filter((item) => item.autoApprove).length;
  const waiting = items.length - approved;
  const parts = [];
  if (approved > 0) parts.push(`${itemsText(approved)} will be approved now.`);
  if (waiting > 0) {
    parts.push(`${itemsText(waiting)} ${waiting === 1 ? 'needs' : 'need'} a moderator's approval.`);
  }
  return parts.join(' ');
}

function DraftItem({ item }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-line py-4">
      <div>
        <p className="text-[15px] text-ink">
          <span className="font-semibold">{item.name}</span>{' '}
          <span className="font-mono text-sm">{item.code}</span>
        </p>
        <Badge status={item.autoApprove ? 'autoApproved' : 'needsApproval'} className="mt-2" />
        {item.condition === 'NEEDS_REPAIR' && (
          <p className="mt-2 text-sm text-warn">needs repair</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => removeDraftItem(item.code)}
        aria-label={`Remove ${item.name} ${item.code}`}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded text-xl text-muted hover:bg-subtle ${focusRing}`}
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}

export default function BorrowPage() {
  const items = useBorrowDraft();
  const navigate = useNavigate();

  function handleCancel() {
    clearDraft();
    navigate('/loans');
  }

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight text-ink">Borrow request</h1>

      {items.length === 0 ? (
        <EmptyState
          className="mt-5"
          title="No items yet"
          text="Scan the QR sticker of an item to add it to your request."
        />
      ) : (
        <section aria-labelledby="items-title" className="mt-5">
          <h2 id="items-title" className="text-xl font-semibold text-ink">
            Items ({items.length})
          </h2>
          <ul className="mt-1">
            {items.map((item) => (
              <DraftItem key={item.code} item={item} />
            ))}
          </ul>
        </section>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface px-5 py-4">
        {items.length > 0 && <p className="text-[15px] text-ink">{summaryText(items)}</p>}
        {/* Enabled when room, until time and reason are filled in (next steps). */}
        <Button fullWidth disabled>
          Send request
        </Button>
        <button
          type="button"
          onClick={handleCancel}
          className={`inline-flex min-h-11 items-center justify-center rounded text-[15px] font-semibold text-brand ${focusRing}`}
        >
          Cancel request
        </button>
      </div>
    </>
  );
}
