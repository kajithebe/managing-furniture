import { useId, useState } from 'react';
import { markLoanItemReturned } from '../../api/moderator.js';
import Modal from '../../components/ui/Modal.jsx';

const NOTE_MAX = 500;

// P12 · Mark returned: "Mark Chair MP-00126 as returned to its home room D569?" with an
// optional note (e.g. "Found in D751, moved back by caretaker") for the item's history.
// row: one M4 row from GET /moderator/overdue.
export default function MarkReturnedDialog({ row, onClose, onReturned, onConflict }) {
  const noteId = useId();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function markReturned() {
    setSending(true);
    setError('');
    try {
      await markLoanItemReturned(row.id, note.trim());
      onReturned(row);
    } catch (err) {
      if (err.status === 404 || err.status === 409) {
        // The item is gone from the list meanwhile: close the pop-up; the list reloads.
        onConflict(err.message);
        return;
      }
      // e.g. the server can't be reached: keep the pop-up (and the typed note) open.
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <Modal
      open
      title="Mark returned"
      onClose={onClose}
      onSave={markReturned}
      saveLabel="Mark returned"
      saveDisabled={sending}
    >
      <p className="text-[15px] text-ink">
        Mark {row.name} <span className="font-mono">{row.code}</span> as returned to its home room{' '}
        {row.homeRoom.name}?
      </p>

      <div>
        <label htmlFor={noteId} className="text-sm font-semibold text-ink">
          Note
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

      {error && (
        <p role="alert" className="text-sm text-danger">
          ! {error}
        </p>
      )}
    </Modal>
  );
}
