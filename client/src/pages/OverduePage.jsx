import OverdueList from '../features/overdue/OverdueList.jsx';

// /mod/overdue – M4 Not yet returned (moderators and admins; the server checks the role too).
export default function OverduePage() {
  return (
    <>
      <h1 className="text-[28px] font-semibold text-ink">Not yet returned</h1>
      <OverdueList />
    </>
  );
}
