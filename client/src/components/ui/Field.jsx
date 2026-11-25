// The hint is replaced by the error, unless keepHint is set: then the hint stays and the
// error is shown under it (M6 Quantity).
export default function Field({
  id,
  label,
  hint,
  error,
  required = false,
  keepHint = false,
  children,
}) {
  const showHint = hint && (!error || keepHint);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && ' *'}
      </label>
      {children}
      {showHint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          ! {error}
        </p>
      )}
    </div>
  );
}
