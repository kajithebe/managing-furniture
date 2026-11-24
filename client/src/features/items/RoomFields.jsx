import SelectWithAdd from '../../components/ui/SelectWithAdd.jsx';

// M6 "Home room" / "Current room": Campus → Building → Room in one row. Building is enabled
// after choosing a campus, Room after choosing a building. value: { campus, building, room }
// (ids as text). Choosing a new campus clears the building and room, and so on.
// Each list has "+ Add new …" at the top; onAddNew(kind) opens the matching pop-up (P4–P6).
function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

export default function RoomFields({ id, legend, value, onChange, onAddNew, campuses }) {
  const campus = campuses.find((entry) => String(entry.id) === value.campus);
  const building = campus?.buildings.find((entry) => String(entry.id) === value.building);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend} *</legend>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <SelectWithAdd
          id={`${id}-campus`}
          label="Campus"
          placeholder=""
          options={toOptions(campuses)}
          value={value.campus}
          addLabel="+ Add new campus"
          onAddNew={() => onAddNew('campus')}
          onChange={(next) => onChange({ campus: next, building: '', room: '' })}
        />
        <SelectWithAdd
          id={`${id}-building`}
          label="Building"
          placeholder={campus ? '' : 'Choose campus'}
          options={toOptions(campus?.buildings ?? [])}
          value={value.building}
          disabled={!campus}
          addLabel="+ Add new building"
          onAddNew={() => onAddNew('building')}
          onChange={(next) => onChange({ ...value, building: next, room: '' })}
        />
        <SelectWithAdd
          id={`${id}-room`}
          label="Room"
          placeholder={building ? '' : 'Choose building'}
          options={toOptions(building?.rooms ?? [])}
          value={value.room}
          disabled={!building}
          addLabel="+ Add new room"
          onAddNew={() => onAddNew('room')}
          onChange={(next) => onChange({ ...value, room: next })}
        />
      </div>
    </fieldset>
  );
}
