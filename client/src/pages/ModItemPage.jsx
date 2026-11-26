import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getItem } from '../api/items.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import ChangeStatusDialog from '../features/items/ChangeStatusDialog.jsx';
import { roomPath, wheelsText } from '../features/items/itemText.js';
import { formatClock } from '../features/requests/format.js';

// M7 · Item details & actions (moderators and admins): /mod/items/:code.
// The History panel comes with the item history timeline (MF-32); "Mark returned" and
// "Open loan detail" come with the Not yet returned page (MF-23) and the loan detail page.
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// Shown status (02) → Badge style (03).
const BADGES = {
  AVAILABLE: 'available',
  ON_LOAN: 'onLoan',
  NEEDS_REPAIR: 'needsRepair',
  BROKEN: 'broken',
  IN_REPAIR: 'inRepair',
  DISPOSED: 'disposed',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "5 Nov 2026, 10:00" (M7 Created by, Current loan "Until …").
function formatDateTime(value) {
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${formatClock(date)}`;
}

// "Items / MP-00123".
function Breadcrumb({ code }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-brand">
      <Link to="/mod/items" className={focusRing}>
        Items
      </Link>{' '}
      / <span className="font-mono">{code}</span>
    </nav>
  );
}

function DetailsCard({ item }) {
  const createdBy = [item.createdBy?.name, formatDateTime(item.createdAt)]
    .filter(Boolean)
    .join(' · ');
  const rows = [
    ['Category', item.category.name],
    ['Brand', item.brand?.name ?? '–'],
    ['Colour', item.colour?.name ?? '–'],
    ['Wheels', wheelsText(item)],
    ['Home room', roomPath(item.homeRoom)],
    ['Now in', item.currentRoom?.name ?? '–'],
    ['Notes', item.notes || '–'],
    ['Created by', createdBy],
  ];

  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">Details</h2>
      <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-4 text-[15px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// M7 · On loan: who has the item and until when. Status and location wait for the return.
function CurrentLoanCard({ item }) {
  const loan = item.currentLoan;
  const room = loan?.toRoom?.name ?? item.currentRoom?.name;

  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">Current loan</h2>
      {loan?.borrower && (
        <p className="mt-4 text-[15px] font-semibold text-ink">{loan.borrower.name}</p>
      )}
      {loan && (
        <p className="mt-2 text-[15px] text-ink">
          Until {formatDateTime(loan.dueAt)} · in {room}
        </p>
      )}
      <p className="mt-4 flex gap-3 rounded-card bg-brand-tint px-4 py-3 text-[15px] text-ink">
        <span aria-hidden="true" className="font-semibold">
          i
        </span>
        <span>Mark the item returned first</span>
      </p>
    </Card>
  );
}

// M7 "More actions" (MF-29): each opens a pop-up that asks for a reason. Shown only while
// the item is not on loan, as in M7 (status and current room wait for the return).
function MoreActionsCard({ onAction }) {
  const actions = [['status', 'Change status']];
  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">More actions</h2>
      <ul className="mt-2">
        {actions.map(([action, label]) => (
          <li key={action}>
            <button
              type="button"
              onClick={() => onAction(action)}
              className={`min-h-11 text-[15px] font-semibold text-brand hover:underline ${focusRing}`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// onChange(item) puts the item from the server on the page after an action.
function ItemView({ item, onChange }) {
  const navigate = useNavigate();
  const code = encodeURIComponent(item.code);
  // The open pop-up: 'status' or null.
  const [action, setAction] = useState(null);

  function saved(updated) {
    onChange(updated);
    setAction(null);
  }

  return (
    <>
      <Breadcrumb code={item.code} />
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink">
          {item.name} <span className="font-mono font-normal">{item.code}</span>
        </h1>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(`/mod/items/${code}/edit`)}>
            Edit
          </Button>
          <Button onClick={() => navigate(`/mod/labels?type=items&codes=${code}`)}>
            Print label
          </Button>
        </div>
      </div>
      <Badge status={BADGES[item.status]} className="mt-2" />

      <div className="mt-6 grid grid-cols-2 items-start gap-6">
        <DetailsCard item={item} />
        <div className="flex flex-col gap-6">
          {item.onLoan ? <CurrentLoanCard item={item} /> : <MoreActionsCard onAction={setAction} />}
        </div>
      </div>

      {action === 'status' && (
        <ChangeStatusDialog item={item} onSaved={saved} onClose={() => setAction(null)} />
      )}
    </>
  );
}

export default function ModItemPage() {
  const { code } = useParams();
  // Counts "Try again" clicks; a new value loads the item again.
  const [attempt, setAttempt] = useState(0);
  // The last answer, with the code and attempt it belongs to (no setState inside the effect body).
  const [result, setResult] = useState({ code: null, attempt: 0, item: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    getItem(code, { signal: controller.signal })
      .then((item) => setResult({ code, attempt, item, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ code, attempt, item: null, error });
      });
    return () => controller.abort();
  }, [code, attempt]);

  if (result.code !== code || result.attempt !== attempt) {
    return (
      <p role="status" className="text-[15px] text-muted">
        Loading item…
      </p>
    );
  }

  const { item, error } = result;
  if (error) {
    const notFound = error.status === 404 || error.status === 400;
    return (
      <>
        <Breadcrumb code={code} />
        <h1 className="mt-4 text-[28px] font-semibold text-ink">
          {notFound ? 'Item not found' : "Couldn't load this item"}
        </h1>
        <LoadError
          className="mt-6"
          message={notFound ? error.message : "Couldn't load this item. Try again."}
          text={notFound ? 'Check the code and try again.' : 'Check your connection and try again.'}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      </>
    );
  }
  return (
    <ItemView
      item={item}
      onChange={(updated) => setResult((current) => ({ ...current, item: updated }))}
    />
  );
}
