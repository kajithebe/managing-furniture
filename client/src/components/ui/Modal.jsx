import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  title,
  onClose,
  onSave,
  saveLabel = 'Save',
  // The text of the secondary button, e.g. "Stay" on P17.
  cancelLabel = 'Cancel',
  saveVariant = 'primary',
  saveDisabled = false,
  // Phone pop-ups (P… on the phone screens, e.g. S9 "Finish return?"): full-width buttons on top
  // of each other, the main action first.
  stacked = false,
  children,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  // Always hold the latest onClose, so the effect below does not depend on it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    // Remember what had focus, so we can give it back when the modal closes.
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first =
      panel?.querySelector('input, select, textarea') ?? panel?.querySelector(FOCUSABLE);
    first?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      // Keep Tab inside the panel (focus trap).
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!saveDisabled) onSave?.();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-5">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[520px] rounded-modal bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded text-xl text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex flex-col gap-4">{children}</div>
          {stacked ? (
            <div className="mt-6 flex flex-col gap-3">
              <Button type="submit" variant={saveVariant} disabled={saveDisabled} fullWidth>
                {saveLabel}
              </Button>
              <Button variant="secondary" onClick={onClose} fullWidth>
                {cancelLabel}
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
              <Button variant="secondary" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button type="submit" variant={saveVariant} disabled={saveDisabled}>
                {saveLabel}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}
