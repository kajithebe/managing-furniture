import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getItem } from '../api/items.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import { approvalText, dueText, roomPath, wheelsText } from '../features/items/itemText.js';
import { useAuth } from '../hooks/useAuth.js';

// S3 · Furniture details & availability: the page a QR scan opens (/i/:code). No photo.
const STAFF = ['MODERATOR', 'ADMIN'];

// Shown status (02) → Badge style (03).
const BADGES = {
  AVAILABLE: 'available',
  ON_LOAN: 'onLoan',
  NEEDS_REPAIR: 'needsRepair',
  BROKEN: 'broken',
  IN_REPAIR: 'inRepair',
  DISPOSED: 'disposed',
};

// Words in "This item can't be borrowed right now (Broken)".
const STATUS_WORDS = { BROKEN: 'Broken', IN_REPAIR: 'In repair', DISPOSED: 'Disposed' };

const NOTICE_TONES = {
  info: 'bg-brand-tint text-ink',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
};

// Box under the badge: "i" for information, "!" for warnings and errors (03: never colour alone).
function Notice({ tone, role, children }) {
  return (
    <p
      role={role}
      className={`mt-4 flex gap-3 rounded-card px-4 py-3 text-[15px] ${NOTICE_TONES[tone]}`}
    >
      <span aria-hidden="true" className="font-semibold">
        {tone === 'info' ? 'i' : '!'}
      </span>
      <span>{children}</span>
    </p>
  );
}

function ItemNotice({ item }) {
  if (item.status === 'NEEDS_REPAIR') {
    return <Notice tone="warn">This item needs repair. You can still borrow it.</Notice>;
  }
  if (item.status === 'ON_LOAN') {
    const loan = item.currentLoan;
    const room = loan?.toRoom?.name ?? item.currentRoom?.name;
    return (
      <Notice tone="info">
        {loan ? `On loan until ${dueText(loan.dueAt)} · in ${room}` : 'On loan'}
      </Notice>
    );
  }
  if (!item.borrowable) {
    return (
      <Notice tone="warn">
        This item can&apos;t be borrowed right now ({STATUS_WORDS[item.status]})
      </Notice>
    );
  }
  return null;
}

// White bar at the bottom of the phone screen with the main action (03: sticky, line border).
function Footer({ children }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface px-5 py-4">
      {children}
    </div>
  );
}

function ItemDetails({ item }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = STAFF.includes(user?.role);

  const rows = [
    ['Category', item.category.name],
    ['Brand', item.brand?.name ?? '–'],
    ['Colour', item.colour?.name ?? '–'],
    ['Wheels', wheelsText(item)],
    ['Home room', roomPath(item.homeRoom)],
    ['Now in', item.currentRoom?.name ?? '–'],
    ['Approval', approvalText(item.category)],
  ];

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight text-ink">
        {item.name || item.category.name}
      </h1>
      <p className="mt-2 font-mono text-xl text-ink">{item.code}</p>
      <Badge status={BADGES[item.status]} className="mt-3 self-start">
        {item.status === 'AVAILABLE' ? 'Free to borrow' : undefined}
      </Badge>

      <ItemNotice item={item} />

      <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3 text-[15px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {(item.borrowable || isStaff) && (
        <Footer>
          {item.borrowable && (
            // The borrow form (/borrow) adds this item to the request.
            <Button
              fullWidth
              onClick={() => navigate('/borrow', { state: { addCode: item.code } })}
            >
              Borrow
            </Button>
          )}
          {isStaff && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(`/mod/items/${encodeURIComponent(item.code)}`)}
            >
              Manage item
            </Button>
          )}
        </Footer>
      )}
    </>
  );
}

// S3 · Not found: a wrong or unknown code (404), or a code the server rejects (400).
function NotFound({ code, error }) {
  const message =
    error.status === 404
      ? error.message
      : `We couldn't find item ${code}. Check the code on the sticker.`;

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight text-ink">Item not found</h1>
      <Notice tone="danger" role="alert">
        {message}
      </Notice>
      {/* "Scan again" is added with the scanner (MF-12 step 3). */}
    </>
  );
}

export default function ItemPage() {
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

  const loading = result.code !== code || result.attempt !== attempt;

  if (loading) {
    return (
      <p role="status" className="text-[15px] text-muted">
        Loading item…
      </p>
    );
  }

  const { item, error } = result;
  if (error && (error.status === 404 || error.status === 400)) {
    return <NotFound code={code} error={error} />;
  }
  if (error) {
    return (
      <LoadError
        message="Couldn't load this item. Try again."
        text="Check your connection and try again."
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }
  return <ItemDetails item={item} />;
}
