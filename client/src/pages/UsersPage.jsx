import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import AddUserDialog from '../features/users/AddUserDialog.jsx';
import UsersList from '../features/users/UsersList.jsx';

// /admin/users – A2 Users (admins only; the server checks the role too).
export default function UsersPage() {
  const [adding, setAdding] = useState(false);
  // A new value loads the list again, e.g. after a user was added.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink">Users</h1>
        <Button onClick={() => setAdding(true)}>+ Add user</Button>
      </div>

      <UsersList reloadKey={reloadKey} />

      {adding && (
        <AddUserDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setReloadKey((current) => current + 1);
          }}
        />
      )}
    </>
  );
}
