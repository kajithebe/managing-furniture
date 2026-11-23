import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import UserHistory from './UserHistory.jsx';
import { ROLES, roleLabel } from './userText.js';

// A2 panel under the table for the chosen user: Role, Status and Deactivate / Reactivate.
// The admin's own row is locked (02 › User safety rules), with one of the two A2 notes.
// showHistory: "View history" was clicked; historyKey reloads the history after a change.
export default function UserPanel({
  user,
  isSelf,
  activeAdmins,
  busy,
  showHistory,
  historyKey,
  onRoleChange,
  onDeactivate,
  onReactivate,
}) {
  // A2 "Last active admin protected": the only active admin sees why nothing can change.
  const note = isSelf
    ? activeAdmins <= 1
      ? 'At least one active admin is needed'
      : "You can't change your own role"
    : null;

  return (
    <Card className="mt-6">
      <h2 className="text-base font-semibold text-ink">
        {user.name} · {roleLabel(user.role)}
      </h2>

      <div className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-4">
        <Select
          id="user-panel-role"
          label="Role"
          options={ROLES}
          value={user.role}
          disabled={isSelf || busy}
          onChange={(event) => {
            // Only a different role opens P15 (not the empty "Choose…" row or the same role).
            const newRole = event.target.value;
            if (newRole && newRole !== user.role) {
              onRoleChange(newRole);
            }
          }}
        />
        <Input
          id="user-panel-status"
          label="Status"
          value={user.active ? 'Active' : 'Deactivated'}
          readOnly
          disabled={isSelf}
        />
        {user.active ? (
          <Button variant="dangerFilled" disabled={isSelf || busy} onClick={onDeactivate}>
            Deactivate
          </Button>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={onReactivate}>
            Reactivate
          </Button>
        )}
      </div>

      {note && (
        <p className="mt-4 rounded-card bg-brand-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="font-semibold text-brand">
            i{' '}
          </span>
          {note}
        </p>
      )}

      {showHistory && <UserHistory userId={user.id} reloadKey={historyKey} />}
    </Card>
  );
}
