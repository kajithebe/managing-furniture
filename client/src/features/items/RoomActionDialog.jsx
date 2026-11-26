import { useEffect, useState } from 'react';
import { changeItemHome, correctItemLocation } from '../../api/items.js';
import { getLookups } from '../../api/lookups.js';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import AddEntryDialog from './AddEntryDialog.jsx';
import RoomFields from './RoomFields.jsx';
import { MAX_REASON, roomValue } from './itemForm.js';
import { addToLookups, roomValueWith } from './lookupsUpdate.js';

// M7 "Correct location" and "Change home room" pop-ups (P13, MF-29): Campus → Building → Room
// with "+ Add new", and a required Reason. The reason is the note of the LOCATION_CORRECTED or
// HOME_CHANGED event. Correct location is opened only while the item is not on loan.
const ACTIONS = {
  location: {
    title: 'Correct location',
    legend: 'Current room',
    room: 'currentRoom',
    send: (code, roomId, reason) => correctItemLocation(code, { currentRoomId: roomId, reason }),
  },
  home: {
    title: 'Change home room',
    legend: 'Home room',
    room: 'homeRoom',
    send: (code, roomId, reason) => changeItemHome(code, { homeRoomId: roomId, reason }),
  },
};

// action: 'location' or 'home'. onSaved(item) gets the updated item from the server.
export default function RoomActionDialog({ action, item, onSaved, onClose }) {
  const config = ACTIONS[action];
  const startRoom = item[config.room];
  const [lookups, setLookups] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [room, setRoom] = useState(() => roomValue(startRoom));
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // The open "+ Add new" pop-up (P4–P6): { kind, parent } or null. While it is open, this
  // pop-up is hidden (its values are kept), so only one pop-up handles Esc and Enter.
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getLookups({ signal: controller.signal })
      .then(setLookups)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError("Couldn't load the rooms. Try again.");
      });
    return () => controller.abort();
  }, []);

  const reasonError = reasonTouched && !reason.trim() ? 'Enter a reason' : undefined;
  const unchanged = !room.room || room.room === String(startRoom.id);
  const disabled = !lookups || unchanged || !reason.trim() || saving;

  async function save() {
    if (disabled) {
      setReasonTouched(true);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      onSaved(await config.send(item.code, Number(room.room), reason.trim()));
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
    }
  }

  // Building and room pop-ups show where the entry is added (P5, P6).
  function openAdd(kind) {
    let parent = null;
    if (kind === 'building' || kind === 'room') {
      const campus = lookups.campuses.find((entry) => String(entry.id) === room.campus);
      const building = campus?.buildings.find((entry) => String(entry.id) === room.building);
      parent =
        kind === 'building'
          ? { id: campus.id, text: `Campus: ${campus.name}` }
          : { id: building.id, text: `${campus.name} · Building ${building.name}` };
    }
    setAdding({ kind, parent });
  }

  // The new (or existing, "Use D575") entry is added to the lists and selected.
  function selectEntry(entry) {
    setLookups((current) => addToLookups(current, adding.kind, entry));
    setRoom((current) => roomValueWith(current, adding.kind, entry));
    setAdding(null);
  }

  return (
    <>
      <Modal
        open={!adding}
        title={config.title}
        saveLabel="Save location"
        saveDisabled={disabled}
        onSave={save}
        onClose={onClose}
      >
        <p className="text-[15px] font-semibold text-ink">
          {item.name} <span className="font-mono font-normal">{item.code}</span>
        </p>
        {loadError ? (
          <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
            ! {loadError}
          </p>
        ) : (
          <RoomFields
            id={`item-${action}`}
            legend={config.legend}
            campuses={lookups?.campuses ?? []}
            value={room}
            onChange={setRoom}
            onAddNew={openAdd}
          />
        )}
        <Input
          id={`item-${action}-reason`}
          label="Reason"
          required
          maxLength={MAX_REASON}
          value={reason}
          error={reasonError}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setReasonTouched(true)}
        />
        {saveError && (
          <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
            ! {saveError}
          </p>
        )}
      </Modal>

      {adding && (
        <AddEntryDialog
          kind={adding.kind}
          parent={adding.parent}
          onAdded={selectEntry}
          onUse={selectEntry}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  );
}
