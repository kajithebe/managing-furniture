import { Link } from 'react-router-dom';
import { formatClock } from '../requests/format.js';
import DashboardPanel from './DashboardPanel.jsx';
import { formatDayClock } from './format.js';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// Words for the item condition in "changed Chair MP-00123 to Needs repair" (02 › Item status).
const CONDITION_LABEL = {
  GOOD: 'Available',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// "Chair MP-00123". The item opens its page, where its history is shown (01 › Dashboard).
function ItemLink({ item }) {
  return (
    <Link
      to={`/mod/items/${encodeURIComponent(item.code)}`}
      className={`text-brand hover:underline ${focusRing}`}
    >
      {item.name} <span className="whitespace-nowrap font-mono">{item.code}</span>
    </Link>
  );
}

const room = (value) => value?.name ?? '—';

// What happened, after the person's name, e.g. "approved Table MP-02210 → D751".
// One line per event type of the ItemEvent model (02 › Data model).
function describe(event) {
  const item = <ItemLink item={event.item} />;
  switch (event.type) {
    case 'CREATED':
      return <>created {item}</>;
    case 'EDITED':
      return <>edited {item}</>;
    case 'BORROWED':
      return (
        <>
          borrowed {item} → {room(event.toRoom)}
        </>
      );
    case 'APPROVED':
      return (
        <>
          approved {item} → {room(event.toRoom)}
        </>
      );
    case 'DECLINED':
      return <>declined {item}</>;
    case 'RETURNED':
      return (
        <>
          returned {item} to {room(event.toRoom)}
        </>
      );
    case 'MARKED_RETURNED':
      return <>marked {item} returned</>;
    case 'OVERDUE':
      return <>{item} is not yet returned</>;
    case 'STATUS_CHANGED':
      // The new condition comes from the note ("NEEDS_REPAIR: Wobbly leg", agreed 23 Nov 2026).
      return event.condition ? (
        <>
          changed {item} to {CONDITION_LABEL[event.condition]}
        </>
      ) : (
        <>changed the status of {item}</>
      );
    case 'LOCATION_CORRECTED':
      return (
        <>
          corrected {item}: {room(event.fromRoom)} → {room(event.toRoom)}
        </>
      );
    case 'HOME_CHANGED':
      return (
        <>
          changed the home room of {item}: {room(event.fromRoom)} → {room(event.toRoom)}
        </>
      );
    default:
      return <>updated {item}</>;
  }
}

// "10:12" for today, "9 Nov, 10:12" for an earlier day.
function formatWhen(value, now) {
  const date = new Date(value);
  return date.toDateString() === new Date(now).toDateString()
    ? formatClock(date)
    : formatDayClock(date);
}

// M1 "Recent activity": the last 10 history events, newest first (sorted by the API).
// The reason or note of each event is shown under the line (agreed 23 Nov 2026).
// React shows all names and notes as plain text.
export default function RecentActivityPanel({ events, now }) {
  return (
    <DashboardPanel title="Recent activity">
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing has happened yet.</p>
      ) : (
        <ol className="space-y-3 text-sm text-ink">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2">
              <span aria-hidden="true" className="text-muted">
                ◷
              </span>
              <div>
                <p>
                  {/* An event without a person, e.g. "not yet returned", starts with the item. */}
                  {event.user && <>{event.user.name} </>}
                  {describe(event)}
                  <span className="text-muted"> · {formatWhen(event.createdAt, now)}</span>
                </p>
                {event.note && <p className="mt-0.5 text-muted">“{event.note}”</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
