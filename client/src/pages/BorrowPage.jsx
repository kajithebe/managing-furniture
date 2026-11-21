import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createLoan } from '../api/loans.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Toast from '../components/ui/Toast.jsx';
import AddItemView from '../features/borrow/AddItemView.jsx';
import { clearDraft, removeDraftItem, useBorrowDraft } from '../features/borrow/borrowDraft.js';
import RequestFields from '../features/borrow/RequestFields.jsx';
import { plural } from '../features/items/itemText.js';

// S4 · Borrow request: the items of one request, each tagged auto-approved / needs approval.
// "+ Add item" opens the S5 scan view; below the list: room, until time and reason.
// Send request → POST /api/loans → S6 Request sent (/borrow/sent, MF-13).

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

// Shown status (02) → Badge style (03), for items the server refused.
const BADGES = {
  ON_LOAN: 'onLoan',
  NEEDS_REPAIR: 'needsRepair',
  BROKEN: 'broken',
  IN_REPAIR: 'inRepair',
  DISPOSED: 'disposed',
};

// S4 · Concurrent loan validation: an item the server refused is shown in red with its
// current status, until the student removes it.
// "4 chairs, 1 table": the items grouped by category, in the order they were added.
function categoriesText(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  return [...counts]
    .map(
      ([category, count]) =>
        `${count} ${(count === 1 ? category : plural(category)).toLowerCase()}`,
    )
    .join(', ');
}

function DraftItem({ item, refusedStatus }) {
  const refused = refusedStatus !== undefined;
  return (
    <li
      className={`flex items-start justify-between gap-3 border-b border-line py-4 ${refused ? '-mx-3 rounded-card bg-danger-bg px-3' : ''}`}
    >
      <div>
        <p className="text-[15px] text-ink">
          <span className="font-semibold">{item.name}</span>{' '}
          <span className="font-mono text-sm">{item.code}</span>
        </p>
        <Badge
          status={
            refused ? BADGES[refusedStatus] : item.autoApprove ? 'autoApproved' : 'needsApproval'
          }
          className="mt-2"
        />
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
  const location = useLocation();
  // "Scan again" on the item page opens the scan view straight away.
  const [scanning, setScanning] = useState(Boolean(location.state?.scan));
  // S5 · Scan succeeded: "✓ Chair MP-00124 added".
  const [added, setAdded] = useState('');
  // The same text as a toast under "Items (n)"; it hides itself after 4 s, the box stays.
  const [toast, setToast] = useState('');
  // S4 · scrolled: while the "Items (n)" heading is out of view, a sticky link leads back to it.
  const [itemsHeading, setItemsHeading] = useState(null);
  const [headingVisible, setHeadingVisible] = useState(true);

  useEffect(() => {
    if (!itemsHeading) return undefined;
    const observer = new IntersectionObserver(([entry]) => setHeadingVisible(entry.isIntersecting));
    observer.observe(itemsHeading);
    return () => observer.disconnect();
  }, [itemsHeading]);

  function scrollToItems() {
    itemsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    itemsHeading.focus({ preventScroll: true });
  }
  const [form, setForm] = useState({ roomId: null, dueAt: '', reason: '' });
  // Longest loan time setting: from the lookups, or from a LOAN_TOO_LONG answer if it changed.
  const [maxLoanHours, setMaxLoanHours] = useState(null);
  const [sending, setSending] = useState(false);
  // The last refused request: { message, items: [{ code, status }] }.
  const [sendError, setSendError] = useState(null);

  // Refused items still in the request; removing them all enables Send request again.
  const refused = new Map(
    (sendError?.items ?? [])
      .filter((entry) => items.some((item) => item.code === entry.code))
      .map((entry) => [entry.code, entry.status]),
  );
  // The error box goes away once every refused item has been removed.
  const showError = sendError && !(sendError.items.length > 0 && refused.size === 0);
  const ready =
    items.length > 0 &&
    refused.size === 0 &&
    form.roomId !== null &&
    form.dueAt !== '' &&
    form.reason.trim() !== '';

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSend() {
    if (!ready || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const loan = await createLoan({
        itemCodes: items.map((item) => item.code),
        toRoomId: form.roomId,
        dueAt: form.dueAt,
        reason: form.reason.trim(),
      });
      clearDraft();
      // replace: the back button does not return to the sent request.
      navigate('/borrow/sent', { state: { loan }, replace: true });
    } catch (error) {
      setSending(false);
      handleSendError(error);
      window.scrollTo({ top: 0 });
    }
  }

  // 02 › Borrow and decision errors: the server's message is shown as it is.
  function handleSendError(error) {
    const { code, details = {}, message } = error;
    if (code === 'ITEM_NOT_AVAILABLE' || code === 'ITEM_NOT_BORROWABLE') {
      setSendError({ message, items: details.items ?? [] });
      return;
    }
    if (code === 'ITEM_NOT_FOUND' && details.itemCode) {
      setSendError({ message, items: [{ code: details.itemCode, status: null }] });
      return;
    }
    if (code === 'LOAN_TOO_LONG' && details.maxLoanHours) {
      setMaxLoanHours(details.maxLoanHours);
      updateForm({ dueAt: '' });
    }
    if (code === 'DUE_IN_PAST') updateForm({ dueAt: '' });
    if (code === 'ROOM_NOT_FOUND') updateForm({ roomId: null });
    setSendError({ message, items: [] });
  }

  function openScanner() {
    setAdded('');
    setToast('');
    setScanning(true);
  }

  function handleAdded(item) {
    const text = `${item.name || item.category.name} ${item.code} added`;
    setAdded(text);
    setToast(text);
    setScanning(false);
  }

  function handleCancel() {
    clearDraft();
    navigate('/loans');
  }

  if (scanning) {
    return <AddItemView onAdded={handleAdded} onBack={() => setScanning(false)} />;
  }

  const addButton = (
    <Button variant="dashed" fullWidth onClick={openScanner}>
      + Add item
    </Button>
  );

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight text-ink">Borrow request</h1>

      {itemsHeading && !headingVisible && (
        <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-page px-5">
          <button
            type="button"
            onClick={scrollToItems}
            className={`flex min-h-11 items-center text-[13px] text-muted ${focusRing}`}
          >
            <span aria-hidden="true">↑&nbsp;</span>
            Items ({items.length}) · {categoriesText(items)}
          </button>
        </div>
      )}

      {showError && (
        <p
          role="alert"
          className="mt-4 flex gap-3 rounded-card bg-danger-bg px-4 py-3 text-[15px] text-danger"
        >
          <span aria-hidden="true">!</span>
          <span>{sendError.message}</span>
        </p>
      )}
      {refused.size > 0 && items.length > refused.size && (
        <p className="mt-3 text-[15px] text-muted">
          Other {itemsText(items.length - refused.size)} remain in your request.
        </p>
      )}

      {added && (
        <p
          role="status"
          className="mt-4 flex gap-3 rounded-card bg-brand-tint px-4 py-3 text-[15px] text-ink"
        >
          <span aria-hidden="true">✓</span>
          <span>{added}</span>
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          className="mt-5"
          title="No items yet"
          text="Scan the QR sticker of an item to add it to your request."
          action={addButton}
        />
      ) : (
        <section aria-labelledby="items-title" className="mt-5">
          <h2
            id="items-title"
            ref={setItemsHeading}
            tabIndex={-1}
            className="scroll-mt-12 text-xl font-semibold text-ink focus:outline-none"
          >
            Items ({items.length})
          </h2>
          <Toast message={toast} onDismiss={() => setToast('')} className="mt-2" />
          <ul className="mt-1">
            {items.map((item) => (
              <DraftItem key={item.code} item={item} refusedStatus={refused.get(item.code)} />
            ))}
          </ul>
          <div className="mt-4">{addButton}</div>
          <RequestFields
            values={form}
            onChange={updateForm}
            maxLoanHours={maxLoanHours}
            onLoanRules={setMaxLoanHours}
          />
        </section>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface px-5 py-4">
        {ready && <p className="text-[15px] text-ink">{summaryText(items)}</p>}
        {!ready && items.length > 0 && (
          <p className="text-sm text-muted">Scroll to choose a room, time and reason ↓</p>
        )}
        <Button fullWidth disabled={!ready || sending} onClick={handleSend}>
          {sending ? 'Sending…' : 'Send request'}
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
