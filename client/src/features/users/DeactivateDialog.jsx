import { useState } from 'react';
import { updateUser } from '../../api/users.js';
import Modal from '../../components/ui/Modal.jsx';
import { deactivateText } from './userText.js';

// P16 · Deactivate user. Users are never deleted; they can be reactivated later.
export default function DeactivateDialog({ user, onClose, onDone }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function deactivate() {
    setSending(true);
    setError('');
    try {
      onDone(await updateUser(user.id, { active: false }));
    } catch (err) {
      // e.g. OWN_STATUS or LAST_ADMIN from the server: keep the pop-up open with the message.
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <Modal
      open
      title="Deactivate user"
      onClose={onClose}
      onSave={deactivate}
      saveLabel="Deactivate user"
      saveVariant="dangerFilled"
      saveDisabled={sending}
    >
      <p className="text-[15px] text-ink">{deactivateText(user)}</p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          ! {error}
        </p>
      )}
    </Modal>
  );
}
