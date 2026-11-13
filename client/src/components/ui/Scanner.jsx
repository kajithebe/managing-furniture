export default function Scanner({
  caption = 'Point at the QR sticker',
  onTypeCode,
  typeCodeLabel = 'Type the code instead',
  className = '',
  children,
}) {
  const classes = [
    'relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-modal bg-scanner',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div className={classes}>
        {/* The camera video from MF-12/MF-13 goes in here as children. */}
        {children}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div aria-hidden="true" className="h-48 w-48 border-2 border-white" />
          <p className="text-sm text-white">{caption}</p>
        </div>
      </div>
      {onTypeCode && (
        <button
          type="button"
          onClick={onTypeCode}
          className="mt-3 inline-flex min-h-11 items-center rounded text-[15px] font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {typeCodeLabel}
        </button>
      )}
    </div>
  );
}