import Field from './Field.jsx';

export default function Input({
  id,
  label,
  hint,
  error,
  required = false,
  mono = false,
  className = '',
  ...rest
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
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
    <Field id={id} label={label} hint={hint} error={error} required={required}>
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