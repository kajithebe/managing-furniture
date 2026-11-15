import { useEffect, useRef } from 'react';

export default function Toast({ message, onDismiss, duration = 4000, className = '' }) {
  // Always hold the latest onDismiss, so the timer below does not restart on every render.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Hide the toast by itself after a few seconds.
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onDismissRef.current?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

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
