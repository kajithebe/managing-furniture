import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { homePathFor } from './returnTo.js';

export default function AccessDenied({ roles }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const adminOnly = roles.length === 1 && roles[0] === 'ADMIN';
  const isStudent = user.role === 'USER';

  return (
    <div className="flex max-w-md flex-col">
      <h1 className="text-[28px] font-semibold leading-tight text-ink">
        You don&apos;t have access to this page
      </h1>
      <p className="mt-3 text-[15px] text-ink">
        {adminOnly
          ? 'This page is only for admins.'
          : 'This page is only for moderators and admins.'}
      </p>
      <Button fullWidth className="mt-5" onClick={() => navigate(homePathFor(user))}>
        {isStudent ? 'Back to my loans' : 'Back to the dashboard'}
      </Button>
    </div>
  );
}
