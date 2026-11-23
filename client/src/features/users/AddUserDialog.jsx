import { useState } from 'react';
import { addUser } from '../../api/users.js';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import { ROLES } from './userText.js';

// P14 · Add user. The browser only checks that the text looks like an email; the allowed
// domain is checked on the server (ALLOWED_EMAIL_DOMAIN, gmail.com on the demo server), which
// answers EMAIL_DOMAIN_NOT_ALLOWED with the P14 text. Same approach as the login page.
const DOMAIN_ERROR = 'Use your @metropolia.fi address';

function looksLikeEmail(email) {
  return /^[^\s@]+@[^\s@]+$/.test(email);
}

export default function AddUserDialog({ onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('USER');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  async function save() {
    const normalized = email.trim().toLowerCase();
    if (!looksLikeEmail(normalized)) {
      setEmailError(DOMAIN_ERROR);
      return;
    }

    setSending(true);
    setFormError('');
    try {
      const user = await addUser({ email: normalized, name: name.trim(), role });
      onAdded(user);
    } catch (error) {
      // EMAIL_DOMAIN_NOT_ALLOWED (P14 text) and EMAIL_TAKEN belong to the Email field.
      if (error.code === 'EMAIL_DOMAIN_NOT_ALLOWED' || error.code === 'EMAIL_TAKEN') {
        setEmailError(error.message);
      } else {
        setFormError(error.message);
      }
      setSending(false);
    }
  }

  return (
    <Modal
      open
      title="Add user"
      onClose={onClose}
      onSave={save}
      saveLabel="Add user"
      // P14 invalid email: the button stays disabled until the email is changed.
      saveDisabled={sending || !email.trim() || Boolean(emailError)}
    >
      <Input
        id="add-user-email"
        label="Email"
        required
        type="text"
        inputMode="email"
        autoComplete="off"
        hint="Only addresses ending in @metropolia.fi"
        error={emailError}
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setEmailError('');
        }}
      />
      <Input
        id="add-user-name"
        label="Name"
        maxLength={100}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Select
        id="add-user-role"
        label="Role"
        required
        options={ROLES}
        value={role}
        onChange={(event) => setRole(event.target.value)}
      />
      <p className="text-[15px] text-ink">
        They log in with a code sent to this email. No password needed.
      </p>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          ! {formError}
        </p>
      )}
    </Modal>
  );
}
