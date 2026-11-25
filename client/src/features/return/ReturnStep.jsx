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
