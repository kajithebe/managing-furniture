// Add / edit item form (M6): empty values, validation with the design's messages, and the
// request body for POST /api/items (02 › API contract). Shared by the Add and Edit pages.

// Status on M6 = the item's condition. "On loan" is never chosen here, only by loans.
// All five conditions from 01 › Adding and editing items, Available by default.
export const CONDITIONS = [
  { value: 'GOOD', label: 'Available' },
  { value: 'NEEDS_REPAIR', label: 'Needs repair' },
  { value: 'BROKEN', label: 'Broken' },
  { value: 'IN_REPAIR', label: 'In repair' },
  { value: 'DISPOSED', label: 'Disposed' },
];

export const EMPTY_ROOM = { campus: '', building: '', room: '' };

// Select values are text (option values), so ids are kept as text until the request is sent.
export const EMPTY_FORM = {
  categoryId: '',
  name: '',
  brandId: '',
  colourId: '',
  hasWheels: false,
  wheelCount: '',
  homeRoom: EMPTY_ROOM,
  currentRoom: EMPTY_ROOM,
  condition: 'GOOD',
  quantity: '1',
  notes: '',
};

export const MAX_QUANTITY = 200;

// "12" → 12; "", "1.5", "abc" → NaN.
function wholeNumber(text) {
  return /^\d+$/.test(String(text).trim()) ? Number(text) : NaN;
}

// The quantity when it is valid, otherwise null.
export function validQuantity(text) {
  const quantity = wholeNumber(text);
  return quantity >= 1 && quantity <= MAX_QUANTITY ? quantity : null;
}

// { field: message } for every field that is not valid yet. Empty object = ready to save.
export function validateItem(form, { withQuantity = true } = {}) {
  const errors = {};
  if (!form.categoryId) errors.categoryId = 'Choose a category';
  if (form.hasWheels) {
    const wheels = wholeNumber(form.wheelCount);
    if (!(wheels >= 1 && wheels <= 12)) errors.wheelCount = 'Enter the number of wheels';
  }
  // Not shown on M6: the design only keeps Save disabled until both rooms are chosen.
  if (!form.homeRoom.room) errors.homeRoom = 'Choose a room';
  if (!form.currentRoom.room) errors.currentRoom = 'Choose a room';
  if (withQuantity && validQuantity(form.quantity) === null) {
    errors.quantity = `Enter a quantity from 1 to ${MAX_QUANTITY}`;
  }
  return errors;
}

const idOrNull = (value) => (value ? Number(value) : null);

// Body for POST /api/items. An empty name is left out, so the server uses the category name.
export function toCreateBody(form) {
  return {
    categoryId: Number(form.categoryId),
    name: form.name.trim() || undefined,
    brandId: idOrNull(form.brandId),
    colourId: idOrNull(form.colourId),
    hasWheels: form.hasWheels,
    wheelCount: form.hasWheels ? wholeNumber(form.wheelCount) : null,
    homeRoomId: Number(form.homeRoom.room),
    currentRoomId: Number(form.currentRoom.room),
    condition: form.condition,
    quantity: validQuantity(form.quantity),
    notes: form.notes.trim() || undefined,
  };
}

// Shown status (02) as text, for the read-only Status field of the Edit form.
export const STATUS_LABELS = {
  AVAILABLE: 'Available',
  ON_LOAN: 'On loan',
  NEEDS_REPAIR: 'Needs repair',
  BROKEN: 'Broken',
  IN_REPAIR: 'In repair',
  DISPOSED: 'Disposed',
};

// A room from GET /api/items/:code → { campus, building, room } for RoomFields.
function roomValue(room) {
  return {
    campus: String(room.building.campus.id),
    building: String(room.building.id),
    room: String(room.id),
  };
}

const idText = (id) => (id ? String(id) : '');

// The Edit form starts with the item's current values.
export function itemToForm(item) {
  return {
    ...EMPTY_FORM,
    categoryId: idText(item.categoryId),
    name: item.name,
    brandId: idText(item.brandId),
    colourId: idText(item.colourId),
    hasWheels: item.hasWheels,
    wheelCount: item.hasWheels ? String(item.wheelCount) : '',
    homeRoom: roomValue(item.homeRoom),
    currentRoom: roomValue(item.currentRoom),
    notes: item.notes ?? '',
  };
}

// Body for PATCH /api/items/:code: the details only. An empty name is sent as "", so the
// server falls back to the category name, as when adding.
export function toUpdateBody(form) {
  return {
    categoryId: Number(form.categoryId),
    name: form.name.trim(),
    brandId: idOrNull(form.brandId),
    colourId: idOrNull(form.colourId),
    hasWheels: form.hasWheels,
    wheelCount: form.hasWheels ? wholeNumber(form.wheelCount) : null,
    notes: form.notes.trim() || null,
  };
}
