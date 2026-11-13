const STYLES = {
  // Loan request / loan item statuses (03)
  autoApproved: { text: 'auto-approved', classes: 'bg-brand-tint text-brand' },
  needsApproval: { text: 'needs approval', classes: 'bg-warn-bg text-warn' },
  pending: { text: 'Waiting', classes: 'bg-warn-bg text-warn' },
  approved: { text: 'Approved', classes: 'bg-brand-tint text-brand' },
  declined: { text: 'Declined', classes: 'bg-danger-bg text-danger' },
  overdue: { text: 'Not yet returned', classes: 'bg-danger-bg text-danger' },
  returned: { text: 'Returned ✓', classes: 'bg-subtle-2 text-muted' },
  // Item statuses (03)
  available: { text: 'Available', classes: 'bg-brand-tint text-brand' },
  onLoan: { text: 'On loan', classes: 'bg-subtle-2 text-ink' },
  needsRepair: { text: 'Needs repair', classes: 'bg-warn-bg text-warn' },
  broken: { text: 'Broken', classes: 'bg-danger-bg text-danger' },
  inRepair: { text: 'In repair', classes: 'bg-warn-bg text-warn' },
  disposed: { text: 'Disposed', classes: 'bg-subtle-2 text-muted line-through' },
};

export default function Badge({ status, children, className = '' }) {
  const style = STYLES[status];
  if (!style) return null;

  const classes = [
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
    style.classes,
    className,
  ].join(' ');

  return <span className={classes}>{children ?? style.text}</span>;
}