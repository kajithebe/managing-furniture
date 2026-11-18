import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../hooks/useAuth.js';

const ROLE_LABELS = { USER: 'User', MODERATOR: 'Moderator', ADMIN: 'Admin' };
const NAME_MAX = 100; // same limit as the server (PATCH /auth/me)

export default function ProfilePage() {
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

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-semibold leading-tight text-ink">Profile</h1>

      <form id="profile-form" noValidate onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
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

      <div className="-mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface p-5">
        <Button type="submit" form="profile-form" fullWidth disabled={!canSave} aria-busy={saving}>
          Save
        </Button>
        <Button variant="secondary" fullWidth onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </div>
  );
}
