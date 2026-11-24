import Field from './Field.jsx';

export default function Input({
  id,
  label,
  hint,
  error,
  required = false,
  keepHint = false,
  mono = false,
  className = '',
  ...rest
}) {
  // Screen readers read the hint and the error that are on screen.
  const showHint = hint && (!error || keepHint);
  const describedBy =
    [showHint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const classes = [
    'h-11 w-full rounded border bg-surface px-3 text-base text-ink',
    'placeholder:text-muted',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:bg-subtle disabled:text-muted',
    error ? 'border-danger' : 'border-line',
    mono ? 'font-mono uppercase' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} keepHint={keepHint}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={classes}
        {...rest}
      />
    </Field>
  );
}
