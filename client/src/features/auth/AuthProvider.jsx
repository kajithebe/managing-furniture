// Holds the logged-in user for the whole app.
// On start it asks the server who is logged in (GET /auth/me); a 401 just means "not logged in".
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '../../api/auth.js';
import { clearDraft } from '../borrow/borrowDraft.js';
import { AuthContext } from './authContext.js';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True right after "Log out": the login guard then opens plain /login, without returnTo, so
  // the next person who logs in on this device lands on their own home page (not on the page
  // the last user was on, e.g. a moderator page a student cannot open).
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    authApi
      .getMe({ signal: controller.signal })
      .then((me) => setUser(me))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // A correct code starts the session cookie on the server and returns the user.
  const login = useCallback(async (email, code) => {
    const me = await authApi.verifyCode(email, code);
    setLoggedOut(false);
    setUser(me);
    return me;
  }, []);

  // Even if the request fails (e.g. session already expired), the app treats the user as logged out.
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignored on purpose: the user is logged out in the app either way.
    } finally {
      // The next person on this phone starts with an empty borrow request.
      clearDraft();
      setLoggedOut(true);
      setUser(null);
    }
  }, []);

  const updateName = useCallback(async (name) => {
    const me = await authApi.updateMe(name);
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, loading, loggedOut, login, logout, updateName }),
    [user, loading, loggedOut, login, logout, updateName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
