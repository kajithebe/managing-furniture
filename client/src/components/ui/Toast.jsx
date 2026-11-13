import { useEffect } from 'react';

export default function Toast({ message, onDismiss, duration = 4000, className = '' }) {
  // Hide the toast by itself after a few seconds.
  useEffect(() => {
    if (!message || !onDismiss) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  const classes = ['rounded bg-ink px-4 py-3 text-sm text-white', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="status" aria-live="polite" className={classes}>
      ✓ {message}
    </div>
  );
}