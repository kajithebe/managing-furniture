import { useId, useState } from 'react';
import { declineLoanItem } from '../../api/moderator.js';
import Modal from '../../components/ui/Modal.jsx';

const NOTE_MAX = 500;

// P10 · Decline request item: optional note to the borrower, red Decline button.
export default function DeclineDialog({ request, item, onClose, onDeclined }) {
  const noteId = useId();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function decline() {
    setSending(true);
    setError('');
    try {
      await declineLoanItem(item.id, note.trim());
      onDeclined(item);
    } catch (err) {
      // e.g. ALREADY_DECIDED: show the API's message and keep the pop-up open.
      setError(err.message);
      setSending(false);
    }
  }

  const title = (
    <>
      Decline {item.name} <span className="font-mono">{item.code}</span> for {request.borrower.name}
      ?
    </>
  );

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      onSave={decline}
      saveLabel="Decline"
      saveVariant="dangerFilled"
      saveDisabled={sending}
    >
      <div>
        <label htmlFor={noteId} className="text-sm font-semibold text-ink">
          Note to the borrower
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          className="mt-2 block w-full rounded border border-line bg-surface px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </div>

      {/* Only true when the request has approved items (needs team agreement). */}
      {request.approved.length > 0 && (
        <p className="rounded-card bg-brand-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="font-semibold text-brand">
            i{' '}
          </span>
          The other items in this request stay approved.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          ! {error}
        </p>
      )}
    </Modal>
  );
}
