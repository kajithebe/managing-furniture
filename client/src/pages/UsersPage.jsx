import UsersList from '../features/users/UsersList.jsx';

// /admin/users – A2 Users (admins only; the server checks the role too).
export default function UsersPage() {
  return (
    <>
      <h1 className="text-[28px] font-semibold text-ink">Users</h1>
      <UsersList />
    </>
  );
}
