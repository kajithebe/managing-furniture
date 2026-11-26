import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { homePathFor } from './returnTo.js';

const TITLE = "You don't have access to this page";
// A student opens a moderator page (phone); a moderator can only be blocked on an admin page
// (Settings, Users), because every other desktop page is open to moderators.
const TEXT = 'This page is only for moderators and admins.';
const ADMIN_ONLY_TEXT = 'This page is only for admins.';

export default function AccessDenied() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const goHome = () => navigate(homePathFor(user));

  // Students see it in the phone layout: full-width primary button (phone frame).
  if (user.role === 'USER') {
    return (
      <div className="flex flex-col">
        <h1 className="text-[28px] font-semibold leading-tight text-ink">{TITLE}</h1>
        <p className="mt-3 text-[15px] text-ink">{TEXT}</p>
        <Button fullWidth className="mt-5" onClick={goHome}>
          Back to my loans
        </Button>
      </div>
    );
  }

  // Moderators see it in the desktop layout: white card, normal-width secondary button (desktop frame).
  return (
    <div className="flex flex-col">
      <h1 className="text-[28px] font-semibold leading-tight text-ink">{TITLE}</h1>
      <div className="mt-5 rounded-card border border-line bg-surface p-5">
        <p className="text-[15px] text-ink">{ADMIN_ONLY_TEXT}</p>
        <Button variant="secondary" className="mt-3" onClick={goHome}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
