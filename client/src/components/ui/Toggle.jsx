// Toggle (03): 36 × 20 px track, `line` when off, `brand` when on; "Off" / "On" on the right
// in `muted`. A button with role="switch", so screen readers announce it as on or off.
// The label is clickable too, so the touch target is larger than the track.
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default function Toggle({ id, label, checked, onChange, className = '' }) {
  return (
    <div className={`flex min-h-11 items-center gap-3 ${className}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${focusRing} ${
          checked ? 'bg-brand' : 'bg-line'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-surface transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-[15px] text-ink">
        {label}
      </label>
      <span aria-hidden="true" className="text-xs text-muted">
        {checked ? 'On' : 'Off'}
      </span>
    </div>
  );
}
