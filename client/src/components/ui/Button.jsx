const BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded px-4 text-[15px] font-semibold ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:cursor-not-allowed';

const VARIANTS = {
  // 03: brand background, white semibold text, hover brand-hover, disabled subtle + muted
  primary:
    'bg-brand text-white enabled:hover:bg-brand-hover disabled:bg-subtle disabled:text-muted',
  // 03: white, 1 px line border, brand semibold text
  secondary:
    'border border-line bg-surface text-brand enabled:hover:bg-page disabled:bg-subtle disabled:text-muted',
  // Secondary with a dashed border, for "+ Add item"
  dashed:
    'border border-dashed border-line bg-surface text-brand enabled:hover:bg-page disabled:bg-subtle disabled:text-muted',
  // Ink background, white text
  dark: 'bg-ink text-white enabled:hover:bg-scanner disabled:bg-subtle disabled:text-muted',
  // Danger text and border on white
  danger:
    'border border-danger bg-surface text-danger enabled:hover:bg-danger-bg disabled:border-line disabled:bg-subtle disabled:text-muted',
  // Filled danger for destructive confirm actions: Decline (M2, P10), Deactivate user (P16)
  dangerFilled:
    'bg-danger text-white enabled:hover:opacity-90 disabled:bg-subtle disabled:text-muted',
};

export default function Button({
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = [
    BASE,
    VARIANTS[variant] ?? VARIANTS.primary,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
