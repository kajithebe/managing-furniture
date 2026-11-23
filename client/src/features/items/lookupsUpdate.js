// After "+ Add new" (or "Use Chair"), the entry is added to the lists already on the page,
// so it can be selected at once without loading every list again. Lists stay sorted by name,
// like GET /api/lookups returns them.
const LIST_KEYS = { category: 'categories', brand: 'brands', colour: 'colours' };

function withEntry(list, entry) {
  if (list.some((existing) => existing.id === entry.id)) return list;
  return [...list, entry].sort((a, b) => a.name.localeCompare(b.name));
}

// kind: category, brand, colour, campus, building or room. Returns a new lookups object.
export function addToLookups(lookups, kind, entry) {
  if (LIST_KEYS[kind]) {
    const key = LIST_KEYS[kind];
    return { ...lookups, [key]: withEntry(lookups[key], entry) };
  }
  if (kind === 'campus') {
    return { ...lookups, campuses: withEntry(lookups.campuses, { buildings: [], ...entry }) };
  }
  return {
    ...lookups,
    campuses: lookups.campuses.map((campus) => {
      if (kind === 'building') {
        return campus.id === entry.campusId
          ? { ...campus, buildings: withEntry(campus.buildings, { rooms: [], ...entry }) }
          : campus;
      }
      return {
        ...campus,
        buildings: campus.buildings.map((building) =>
          building.id === entry.buildingId
            ? { ...building, rooms: withEntry(building.rooms, entry) }
            : building,
        ),
      };
    }),
  };
}

// The new value of a room field ({ campus, building, room }) after adding or using an entry.
export function roomValueWith(value, kind, entry) {
  const id = String(entry.id);
  if (kind === 'campus') return { campus: id, building: '', room: '' };
  if (kind === 'building') return { ...value, building: id, room: '' };
  return { ...value, room: id };
}
