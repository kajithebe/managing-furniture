export function safeReturnTo(value) {
  if (typeof value !== 'string' || value === '') return null;
  // Must be a path on this site: one leading "/", not "//" (another host).
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  // Browsers treat "\" like "/" and drop tabs/newlines, so "/\evil.com" could become "//evil.com".
  if (/[\s\\]/.test(value)) return null;
  // Never send the user back to the login pages themselves.
  if (value === '/login' || value.startsWith('/login/') || value.startsWith('/login?')) return null;
  return value;
}

// Where a user lands after login when there is no returnTo.
export function homePathFor(user) {
  return user.role === 'MODERATOR' || user.role === 'ADMIN' ? '/mod' : '/loans';
}

// "/login?returnTo=/i/MP-00123" for the page the user tried to open.
export function loginPathFor(location) {
  const target = `${location.pathname}${location.search}`;
  return `/login?returnTo=${encodeURIComponent(target)}`;
}
