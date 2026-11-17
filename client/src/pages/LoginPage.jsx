// S1 · Log in with your Metropolia email (design-screens/figma-1, frames S1).
import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { requestCode } from '../api/auth.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import LoginNotice from '../features/auth/LoginNotice.jsx';
import { homePathFor, safeReturnTo, scannedItemCode } from '../features/auth/returnTo.js';
import { useAuth } from '../hooks/useAuth.js';

// Quick check for a better message before sending. The server (ALLOWED_EMAIL_DOMAIN) is the
// real check; if it refuses, its message is shown in the same place.
const EMAIL_DOMAIN = '@metropolia.fi';
const DOMAIN_ERROR = `Use your ${EMAIL_DOMAIN} address`;

function looksAllowed(email) {
  return /^[^\s@]+@[^\s@]+$/.test(email) && email.endsWith(EMAIL_DOMAIN);
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const scannedCode = scannedItemCode(returnTo);

  // "Use another email" on S2 comes back here with the old email filled in.
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={returnTo ?? homePathFor(user)} replace />;

  function handleChange(event) {
    setEmail(event.target.value);
    setEmailError('');
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!looksAllowed(normalized)) {
      setEmailError(DOMAIN_ERROR);
      return;
    }

    setSending(true);
    setFormError('');
    try {
      await requestCode(normalized);
      // The email goes in router state, not in the URL, so it stays out of history and logs.
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
      navigate(`/login/code${query}`, { state: { email: normalized, sentAt: Date.now() } });
    } catch (error) {
      if (error.code === 'EMAIL_DOMAIN_NOT_ALLOWED') {
        setEmailError(error.message);
      } else {
        setFormError(error.message);
      }
    } finally {
      setSending(false);
    }
  }

  const canSend = email.trim() !== '' && !emailError && !sending;

  return (
    <div className="flex flex-1 flex-col">
      {scannedCode && (
        <div className="mb-4 flex gap-3 rounded-card bg-brand-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="font-semibold">
            i
          </span>
          <p>
            You scanned
            <br />
            <span className="font-mono">{scannedCode}</span>
          </p>
        </div>
      )}

      <h1 className="text-[28px] font-semibold leading-tight text-ink">
        Log in with your Metropolia email
      </h1>
      <p className="mt-3 text-[15px] text-muted">Borrow furniture and keep track of your loans.</p>

      <form noValidate onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <Input
          id="email"
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={handleChange}
          hint={`Only addresses ending in ${EMAIL_DOMAIN}`}
          error={emailError}
        />

        {formError && <LoginNotice>{formError}</LoginNotice>}

        <Button type="submit" fullWidth disabled={!canSend} aria-busy={sending}>
          {sending && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          Send me a code
        </Button>
      </form>

      <footer className="-mx-5 -mb-5 mt-auto border-t border-line bg-surface px-5 py-4 text-xs text-muted">
        Works only on Metropolia&apos;s network.
      </footer>
    </div>
  );
}
