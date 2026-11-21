import { useNavigate } from 'react-router-dom';
import DesktopLayout from '../components/layout/DesktopLayout.jsx';
import PhoneLayout from '../components/layout/PhoneLayout.jsx';
import Button from '../components/ui/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';

const TITLE = 'Page not found';
const STAFF = ['MODERATOR', 'ADMIN'];

// Any address that is not a page (router "*").
// Moderators and admins: "Shared · 404 desktop" inside the side menu layout, back to the dashboard.
// Students and visitors who are not logged in: "Shared · Page not found" in the phone layout,
// back to My loans (which asks for the login first if needed).
export default function NotFoundPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Wait for GET /auth/me, so a moderator does not briefly see the phone version.
  if (loading) {
    return (
      <p role="status" className="p-5 text-sm text-muted">
        Loading…
      </p>
    );
  }

  if (user && STAFF.includes(user.role)) {
    return (
      <DesktopLayout>
        <h1 className="text-[28px] font-semibold leading-tight text-ink">{TITLE}</h1>
        <div className="mt-5 rounded-card border border-line bg-surface p-5">
          <p className="text-[15px] text-ink">The page may have moved. Go back to the dashboard.</p>
          <Button className="mt-3" onClick={() => navigate('/mod')}>
            Back to dashboard
          </Button>
        </div>
      </DesktopLayout>
    );
  }

  return (
    <PhoneLayout>
      <h1 className="text-[28px] font-semibold leading-tight text-ink">{TITLE}</h1>
      <p className="mt-3 text-[15px] text-ink">Check the address and try again.</p>
      <Button fullWidth className="mt-5" onClick={() => navigate('/loans')}>
        Back to my loans
      </Button>
    </PhoneLayout>
  );
}
