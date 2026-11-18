// S2 · Check your email (design-screens/figma-1, frames S2: countdown, ready, wrong code, expired).
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { requestCode } from '../api/auth.js';
import Button from '../components/ui/Button.jsx';
import CodeInput from '../features/auth/CodeInput.jsx';
import LoginNotice from '../features/auth/LoginNotice.jsx';
import { homePathFor, safeReturnTo } from '../features/auth/returnTo.js';
import { useAuth } from '../hooks/useAuth.js';

const RESEND_SECONDS = 45;
const LINK =
  'h-11 rounded text-[15px] font-semibold text-brand disabled:text-muted ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function formatSeconds(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function LoginCodePage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const email = location.state?.email;

  const [code, setCode] = useState('');
  const [error, setError] = useState(null); // { kind: 'wrong' | 'expired' | 'other', message }
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(() => location.state?.sentAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());

  const secondsLeft = Math.min(
    RESEND_SECONDS,
    Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000)),
  );
  const counting = secondsLeft > 0;

  // Tick once a second while the "Send a new code in 0:45" countdown runs.
  useEffect(() => {
    if (!counting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  // After a correct code, login() sets the user and this sends them on.
  if (user) return <Navigate to={returnTo ?? homePathFor(user)} replace />;
  // Opened directly or reloaded: we don't know the email, so start again at S1.
  if (!email) return <Navigate to={`/login${query}`} replace />;

  function handleCodeChange(next) {
    setCode(next);
    // An expired code stays expired until a new one is sent.
    if (error?.kind !== 'expired') setError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await login(email, code);
    } catch (err) {
      const kind =
        err.code === 'CODE_WRONG' ? 'wrong' : err.code === 'CODE_EXPIRED' ? 'expired' : 'other';
      setError({ kind, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError(null);
    try {
      await requestCode(email);
      setCode('');
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      setError({ kind: 'other', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const codeInvalid = error?.kind === 'wrong' || error?.kind === 'expired';
  const canLogIn = code.length === 6 && !busy && error?.kind !== 'expired';

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-semibold leading-tight text-ink">Check your email</h1>
      <p className="mt-3 text-[15px] text-ink">
        We sent a 6-digit code to <span className="break-all">{email}</span>. It is valid for 10
        minutes.
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span id="code-label" className="text-sm font-semibold text-ink">
            Code
          </span>
          <CodeInput
            value={code}
            onChange={handleCodeChange}
            labelledBy="code-label"
            invalid={codeInvalid}
          />
        </div>

        {error && <LoginNotice>{error.message}</LoginNotice>}

        <Button type="submit" fullWidth disabled={!canLogIn} aria-busy={busy}>
          Log in
        </Button>
      </form>

      <div className="mt-3 flex flex-col gap-1">
        {counting ? (
          <Button variant="secondary" fullWidth disabled>
            Send a new code in {formatSeconds(secondsLeft)}
          </Button>
        ) : (
          <button type="button" onClick={handleResend} disabled={busy} className={LINK}>
            Send a new code
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/login${query}`, { state: { email } })}
          className={LINK}
        >
          Use another email
        </button>
      </div>
    </div>
  );
}
