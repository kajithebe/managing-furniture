import Badge from '../../components/ui/Badge.jsx';
import { itemBadgeStatus, recentTitle } from './loanFormat.js';

// S7 Recent loans: one closed loan, "9 Nov · 5 items · returned ⌄".
// <details> opens and closes without any state, and works with the keyboard and screen readers.
export default function RecentLoanCard({ loan }) {
  return (
    <details className="group rounded-card border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-card px-5 py-4 text-[15px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        {recentTitle(loan)}
        <span aria-hidden="true" className="text-sm text-muted group-open:rotate-180">
          ⌄
        </span>
      </summary>

      <div className="border-t border-line px-5 pb-2 pt-3">
        <p className="text-sm text-muted">
          In {loan.toRoom.name}
          {loan.reason ? ` · ${loan.reason}` : ''}
        </p>
        <ul>
          {loan.items.map((item) => (
            <li key={item.id} className="border-b border-line py-3 last:border-b-0">
              <p className="text-[15px] text-ink">
                <span className="font-semibold">{item.name}</span>{' '}
                <span className="font-mono text-sm">{item.code}</span>
              </p>
              <Badge className="mt-2" status={itemBadgeStatus(item.status, loan.dueAt)} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
