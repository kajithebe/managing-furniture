export default function Checkbox({ id, label, className = '', children, ...rest }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] text-ink">
        <input
          id={id}
          type="checkbox"
          className="h-[18px] w-[18px] cursor-pointer accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          {...rest}
        />
        {label}
      </label>
      {children && <div className="ml-[22px]">{children}</div>}
    </div>
  );
}
