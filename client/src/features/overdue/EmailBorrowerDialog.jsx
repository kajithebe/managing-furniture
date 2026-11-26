import { useEffect, useState } from 'react';
import { contactBorrower, getContactPreview } from '../../api/moderator.js';
import Modal from '../../components/ui/Modal.jsx';

// P11 · Email borrower: a read-only preview of the email ("To: … · Read-only preview",
// the subject and the message) and Send email. The text comes from the server, so it is
// exactly the email that will be sent. row: one M4 row from GET /moderator/overdue.
export default function EmailBorrowerDialog({ row, onClose, onSent, onConflict }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // The preview is loaded when the pop-up opens. A 404 / 409 means the item is not late any
  // more (e.g. scanned back meanwhile): the pop-up closes and the list reloads.
  useEffect(() => {
    const controller = new AbortController();
    getContactPreview(row.id, { signal: controller.signal })
      .then(setPreview)
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (err.status === 404 || err.status === 409) {
          onConflict(err.message);
        } else {
          setLoadError(err.message);
        }
      });
    return () => controller.abort();
  }, [row.id, onConflict]);

  async function send() {
    setSending(true);
    setSendError('');
    try {
      await contactBorrower(row.id);
      onSent(row);
    } catch (err) {
      if (err.status === 404 || err.status === 409) {
        onConflict(err.message);
        return;
      }
      // e.g. "The email could not be sent. Please try again.": keep the pop-up open.
      setSendError(err.message);
      setSending(false);
    }
  }

  return (
    <Modal
      open
      title="Email borrower"
      onClose={onClose}
      onSave={send}
      saveLabel="Send email"
      saveDisabled={!preview || sending}
    >
      {!preview && !loadError && <p className="text-sm text-muted">Loading…</p>}

      {loadError && (
        <p role="alert" className="text-sm text-danger">
          ! {loadError}
        </p>
      )}

      {preview && (
        <>
          <p className="text-xs text-muted">To: {preview.to} · Read-only preview</p>
          <p className="text-[15px] font-semibold text-ink">Subject: {preview.subject}</p>
          <p className="whitespace-pre-line text-[15px] text-ink">{preview.message}</p>
        </>
      )}

      {sendError && (
        <p role="alert" className="text-sm text-danger">
          ! {sendError}
        </p>
      )}
    </Modal>
  );
}
