import { useEffect, useState } from 'react';
import { getLookups } from '../../api/lookups.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import RoomPicker from './RoomPicker.jsx';
import { hoursText, untilOptions } from './untilOptions.js';

// S4 · Room and time options: "Move to room *", "Until *" and "Why? *" (max 120 characters,
// the same limit as POST /api/loans). values: { roomId, dueAt, reason }; onChange gets a patch.
const REASON_MAX = 120;

// "Karaportti · D · D751" for every room in GET /api/lookups.
function toRooms(lookups) {
  return lookups.campuses.flatMap((campus) =>
    campus.buildings.flatMap((building) =>
      building.rooms.map((room) => ({
        id: room.id,
        label: `${campus.name} · ${building.name} · ${room.name}`,
      })),
    ),
  );
}

export default function RequestFields({ values, onChange, maxLoanHours }) {
  // Counts "Try again" clicks; a new value loads the rooms again.
  const [attempt, setAttempt] = useState(0);
  const [lookups, setLookups] = useState({ attempt: -1, rooms: null });
  // The until times are counted from this moment; refreshed when the list is opened.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const controller = new AbortController();
    getLookups({ signal: controller.signal })
      .then((data) => setLookups({ attempt, rooms: toRooms(data) }))
      .catch((error) => {
        if (error.name !== 'AbortError') setLookups({ attempt, rooms: null });
      });
    return () => controller.abort();
  }, [attempt]);

  const times = untilOptions(now, maxLoanHours);

  // A time chosen a while ago can now be in the past: then it is cleared.
  function refreshTimes() {
    const fresh = new Date();
    setNow(fresh);
    if (values.dueAt && !untilOptions(fresh, maxLoanHours).some((t) => t.value === values.dueAt)) {
      onChange({ dueAt: '' });
    }
  }

  let roomField;
  if (lookups.attempt !== attempt) {
    roomField = (
      <p role="status" className="text-[15px] text-muted">
        Loading rooms…
      </p>
    );
  } else if (!lookups.rooms) {
    roomField = (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-danger">
          ! Couldn&apos;t load the rooms.
        </p>
        <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </Button>
      </div>
    );
  } else {
    roomField = (
      <RoomPicker
        id="to-room"
        rooms={lookups.rooms}
        value={values.roomId}
        onChange={(roomId) => onChange({ roomId })}
      />
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {roomField}
      <Select
        id="due-at"
        label="Until"
        required
        placeholder="Choose a time"
        options={times}
        value={values.dueAt}
        onFocus={refreshTimes}
        onChange={(event) => onChange({ dueAt: event.target.value })}
        hint={`Longest allowed: ${hoursText(maxLoanHours)}`}
      />
      <Input
        id="reason"
        label="Why?"
        required
        value={values.reason}
        maxLength={REASON_MAX}
        placeholder="e.g. Group work"
        onChange={(event) => onChange({ reason: event.target.value })}
        hint={`${values.reason.length} / ${REASON_MAX} characters`}
      />
    </div>
  );
}
