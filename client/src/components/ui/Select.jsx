import Field from './Field.jsx';

export default function Select({
  id,
  label,
  hint,
  error,
  required = false,
  placeholder = 'Choose…',
  options = [],
  className = '',
  ...rest
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const classes = [
    'h-11 w-full rounded border bg-surface px-3 text-base text-ink',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:bg-subtle disabled:text-muted',
    error ? 'border-danger' : 'border-line',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={classes}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}