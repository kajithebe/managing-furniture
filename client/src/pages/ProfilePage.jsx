import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../hooks/useAuth.js';

const ROLE_LABELS = { USER: 'User', MODERATOR: 'Moderator', ADMIN: 'Admin' };
const NAME_MAX = 100; // same limit as the server (PATCH /auth/me)

// S11 Profile. Students see it in the phone layout (/profile). Moderators and admins open the
// same form from the desktop side menu (/mod/profile, decided 19 Nov 2026): the design has no
// desktop Profile screen, so the form sits in a card and the side menu stays visible.
export default function ProfilePage({ desktop = false }) {
  const { user, updateName, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // RequireAuth only shows this page to logged-in users; this covers the moment of logging out.
  if (!user) return null;

  const trimmed = name.trim();
  // Save is enabled only when there is a new, non-empty name (disabled again after saving).
  const canSave = trimmed !== '' && trimmed !== (user.name ?? '') && !saving;

  function handleChange(event) {
    setName(event.target.value);
    setError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const me = await updateName(trimmed);
      setName(me.name ?? '');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const title = <h1 className="text-[28px] font-semibold leading-tight text-ink">Profile</h1>;

  // The same fields on phone and desktop.
  const form = (
    <form id="profile-form" noValidate onSubmit={handleSave} className="flex flex-col gap-4">
      <Input
        id="name"
        label="Name"
        autoComplete="name"
        maxLength={NAME_MAX}
        value={name}
        onChange={handleChange}
        hint="Taken from your email; you can correct it"
        error={error}
      />

      <Input id="profile-email" label="Email" value={user.email} disabled readOnly />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Role</p>
        <p>
          <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand">
            • {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </p>
      </div>
    </form>
  );

  const saveButton = (fullWidth) => (
    <Button
      type="submit"
      form="profile-form"
      fullWidth={fullWidth}
      disabled={!canSave}
      aria-busy={saving}
    >
      Save
    </Button>
  );

  const logoutButton = (fullWidth) => (
    <Button variant="secondary" fullWidth={fullWidth} onClick={handleLogout}>
      Log out
    </Button>
  );

  if (desktop) {
    return (
      <div className="max-w-xl">
        {title}
        <Card className="mt-5">
          {form}
          <div className="mt-5 flex justify-end gap-3 border-t border-line pt-5">
            {logoutButton(false)}
            {saveButton(false)}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {title}
      <div className="mt-5">{form}</div>

      <div className="-mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface p-5">
        {saveButton(true)}
        {logoutButton(true)}
      </div>
    </div>
  );
}
