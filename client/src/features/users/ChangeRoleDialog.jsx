import { useState } from 'react';
import { updateUser } from '../../api/users.js';
import Modal from '../../components/ui/Modal.jsx';
import { ROLE_ABILITIES, roleLabel } from './userText.js';

// P15 · Change role: "Change Mikko Laine from User to Moderator?" and what the new role can do.
export default function ChangeRoleDialog({ user, newRole, onClose, onDone }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const abilities = ROLE_ABILITIES[newRole];

  async function changeRole() {
    setSending(true);
    setError('');
    try {
      onDone(await updateUser(user.id, { role: newRole }));
    } catch (err) {
      // e.g. OWN_ROLE or LAST_ADMIN from the server: keep the pop-up open with the message.
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <Modal
      open
      title="Change role"
      onClose={onClose}
      onSave={changeRole}
      saveLabel="Change role"
      saveDisabled={sending}
    >
      <p className="text-[15px] text-ink">
        Change {user.name} from {roleLabel(user.role)} to {roleLabel(newRole)}?
      </p>
      <div className="text-[15px] text-ink">
        <p>{abilities.intro}</p>
        <ul className="mt-2 list-disc pl-5">
          {abilities.items.map((ability) => (
            <li key={ability}>{ability}</li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          ! {error}
        </p>
      )}
    </Modal>
  );
}
