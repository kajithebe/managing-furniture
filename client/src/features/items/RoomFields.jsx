import Select from '../../components/ui/Select.jsx';

// M6 "Home room" / "Current room": Campus → Building → Room in one row. Building is enabled
// after choosing a campus, Room after choosing a building. value: { campus, building, room }
// (ids as text). Choosing a new campus clears the building and room, and so on.
function toOptions(list) {
  return list.map((entry) => ({ value: String(entry.id), label: entry.name }));
}

export default function RoomFields({ id, legend, value, onChange, onBlur, campuses, error }) {
  const campus = campuses.find((entry) => String(entry.id) === value.campus);
  const building = campus?.buildings.find((entry) => String(entry.id) === value.building);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend} *</legend>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <Select
          id={`${id}-campus`}
          label="Campus"
          placeholder=""
          options={toOptions(campuses)}
          value={value.campus}
          onChange={(event) => onChange({ campus: event.target.value, building: '', room: '' })}
        />
        <Select
          id={`${id}-building`}
          label="Building"
          placeholder={campus ? '' : 'Choose campus'}
          options={toOptions(campus?.buildings ?? [])}
          value={value.building}
          disabled={!campus}
          onChange={(event) => onChange({ ...value, building: event.target.value, room: '' })}
        />
        <Select
          id={`${id}-room`}
          label="Room"
          placeholder={building ? '' : 'Choose building'}
          options={toOptions(building?.rooms ?? [])}
          value={value.room}
          disabled={!building}
          error={error}
          onChange={(event) => onChange({ ...value, room: event.target.value })}
          onBlur={onBlur}
        />
      </div>
    </fieldset>
  );
}
