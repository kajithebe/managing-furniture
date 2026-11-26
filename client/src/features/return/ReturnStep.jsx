// Shared frame of the return screens (S8, S9, S10): the page heading, the content, and the
// white bar at the bottom of the phone with the actions (as in the design).
export default function ReturnStep({ title, footer, children }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-semibold leading-tight text-ink">{title}</h1>
      {children}
      {footer && (
        <div className="-mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface p-5">
          {footer}
        </div>
      )}
    </div>
  );
}

// Text-only action in brand colour ("Back to my loans", "Type the room instead"),
// same look as the link under the UI kit Scanner. min-h-11 keeps the 44 px touch target.
export function LinkButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center rounded text-[15px] font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </button>
  );
}

// Danger box under the scanner (S8 wrong room, S9 wrong item / wrong home room).
// The text is shown as plain text (React escapes it); it is usually error.message from the API.
export function ErrorBox({ children, className = '' }) {
  return (
    <p
      role="alert"
      className={`flex gap-3 rounded-card bg-danger-bg px-4 py-3 text-[15px] text-danger ${className}`}
    >
      <span aria-hidden="true">!</span>
      <span>{children}</span>
    </p>
  );
}

// Green box at the top of S9: "✓ In room D569 ✓".
export function SuccessBox({ children, className = '' }) {
  return (
    <p
      role="status"
      className={`flex gap-3 rounded-card bg-brand-tint px-4 py-3 text-[15px] text-ink ${className}`}
    >
      <span aria-hidden="true" className="font-semibold text-brand">
        ✓
      </span>
      <span>{children}</span>
    </p>
  );
}
