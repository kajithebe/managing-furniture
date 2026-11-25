// Items (01 › Adding and editing items, 02 › Asset codes).
// Creating items: one request can add 1–200 identical items (bulk add). All items, their codes
// and their CREATED events are saved in one transaction: either all of them or none.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { reserveCodes } from './codeService.js';
import { currentLoanOf } from './loanService.js';

// The item fields returned by the API.
const itemFields = {
  id: true,
  code: true,
  name: true,
  categoryId: true,
  brandId: true,
  colourId: true,
  hasWheels: true,
  wheelCount: true,
  notes: true,
  homeRoomId: true,
  currentRoomId: true,
  condition: true,
  onLoan: true,
  createdById: true,
  createdAt: true,
};

// Room with its building and campus, e.g. for "Karaportti · D · D569".
const roomFields = {
  select: {
    id: true,
    name: true,
    building: { select: { id: true, name: true, campus: { select: { id: true, name: true } } } },
  },
};

// Single item: with category rule, brand, colour and both rooms.
const itemDetailFields = {
  ...itemFields,
  category: { select: { id: true, name: true, code: true, autoApprove: true } },
  brand: { select: { id: true, name: true } },
  colour: { select: { id: true, name: true } },
  homeRoom: roomFields,
  currentRoom: roomFields,
};

// 02 › Item status shown in the app: condition and loan state are stored separately.
export const SHOWN_STATUSES = [
  'AVAILABLE',
  'ON_LOAN',
  'NEEDS_REPAIR',
  'BROKEN',
  'IN_REPAIR',
  'DISPOSED',
];

function shownStatus(item) {
  if (item.onLoan) {
    return 'ON_LOAN';
  }
  return item.condition === 'GOOD' ? 'AVAILABLE' : item.condition;
}

// Adds the shown status and whether the item can be borrowed (02 › status table).
function withStatus(item) {
  return {
    ...item,
    status: shownStatus(item),
    borrowable: !item.onLoan && ['GOOD', 'NEEDS_REPAIR'].includes(item.condition),
  };
}

// The database filter for one shown status.
function statusWhere(status) {
  if (status === 'ON_LOAN') {
    return { onLoan: true };
  }
  return { onLoan: false, condition: status === 'AVAILABLE' ? 'GOOD' : status };
}

// S3 "Item not found": the scanned or typed code, in the screen's wording.
function itemNotFound(code) {
  return new AppError(
    404,
    'ITEM_NOT_FOUND',
    `We couldn't find item ${code}. Check the code on the sticker.`,
    { itemCode: code },
  );
}

// GET /api/items/:code. viewer: the logged-in user (decides whether the borrower is shown).
export async function getItem(code, viewer) {
  const item = await prisma.item.findUnique({ where: { code }, select: itemDetailFields });
  if (!item) {
    throw itemNotFound(code);
  }

  // M7 "Created by Mikko Laine · 5 Nov 2026, 10:00": the creator's name (no email).
  // Item.createdById has no relation in the schema, so the user is read separately.
  const createdBy = item.createdById
    ? await prisma.user.findUnique({
        where: { id: item.createdById },
        select: { id: true, name: true },
      })
    : null;

  // S3 / M7: the open loan of an item that is on loan (MF-10).
  const currentLoan = item.onLoan ? await currentLoanOf(item.id, viewer) : null;

  return { ...withStatus(item), createdBy, currentLoan };
}

// sortable columns → database order. The code is always added last, so rows with the
// same value (e.g. many "Chair") keep a stable order across pages.
export const SORT_COLUMNS = [
  'code',
  'name',
  'category',
  'brand',
  'colour',
  'wheels',
  'homeRoom',
  'currentRoom',
  'status',
];

function orderBy(sort, order) {
  const columns = {
    code: [],
    name: [{ name: order }],
    category: [{ category: { name: order } }],
    brand: [{ brand: { name: order } }],
    colour: [{ colour: { name: order } }],
    wheels: [{ hasWheels: order }, { wheelCount: order }],
    homeRoom: [{ homeRoom: { name: order } }],
    currentRoom: [{ currentRoom: { name: order } }],
    // Shown status: free items first, then by condition (Available, Needs repair, …).
    status: [{ onLoan: order }, { condition: order }],
  };
  return [...columns[sort], { code: sort === 'code' ? order : 'asc' }];
}

// A room filter (campus, building or room) matches the item's home room or current room.
function roomWhere(roomFilter) {
  return { OR: [{ homeRoom: roomFilter }, { currentRoom: roomFilter }] };
}

// GET /api/items (M5): filters, search on code, name and brand, sorting and paging.
// Disposed items are hidden unless showDisposed is on or the Disposed status is chosen.
export async function listItems(query) {
  const { category, campus, building, room, status, showDisposed, q } = query;
  const { sort, order, page, pageSize } = query;

  const conditions = [];
  if (category) {
    conditions.push({ categoryId: category });
  }
  if (campus) {
    conditions.push(roomWhere({ building: { campusId: campus } }));
  }
  if (building) {
    conditions.push(roomWhere({ buildingId: building }));
  }
  if (room) {
    conditions.push(roomWhere({ id: room }));
  }
  if (status) {
    conditions.push(statusWhere(status));
  } else if (!showDisposed) {
    conditions.push({ condition: { not: 'DISPOSED' } });
  }
  if (q) {
    conditions.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  const where = { AND: conditions };

  const [items, total] = await prisma.$transaction([
    prisma.item.findMany({
      where,
      select: itemDetailFields,
      orderBy: orderBy(sort, order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  return { data: items.map(withStatus), total };
}

// Checks that a referenced category, brand, colour or room exists and is not archived.
async function checkActive(model, id, label) {
  const row = await model.findUnique({ where: { id }, select: { archived: true, name: true } });
  if (!row || row.archived) {
    throw new AppError(400, 'INVALID_REFERENCE', `${label} not found.`);
  }
  return row;
}

// `data` is already validated by the route. `userId` is the logged-in moderator.
// Returns the created items, in code order.
export async function createItems(data, userId) {
  const { quantity, ...fields } = data;

  const category = await checkActive(prisma.category, fields.categoryId, 'Category');
  if (fields.brandId) {
    await checkActive(prisma.brand, fields.brandId, 'Brand');
  }
  if (fields.colourId) {
    await checkActive(prisma.colour, fields.colourId, 'Colour');
  }
  await checkActive(prisma.room, fields.homeRoomId, 'Home room');
  const currentRoomId = fields.currentRoomId ?? fields.homeRoomId;
  if (currentRoomId !== fields.homeRoomId) {
    await checkActive(prisma.room, currentRoomId, 'Current room');
  }

  const row = {
    ...fields,
    name: fields.name || category.name, // name defaults to the category name
    wheelCount: fields.hasWheels ? fields.wheelCount : null,
    currentRoomId,
    createdById: userId,
  };

  return prisma.$transaction(async (tx) => {
    const codes = await reserveCodes(tx, quantity);

    const items = await tx.item.createManyAndReturn({
      data: codes.map((code) => ({ ...row, code })),
      select: itemFields,
    });

    // Item history: one CREATED event per item.
    await tx.itemEvent.createMany({
      data: items.map((item) => ({
        itemId: item.id,
        type: 'CREATED',
        userId,
        toRoomId: item.currentRoomId,
      })),
    });

    return items.sort((a, b) => a.id - b.id);
  });
}

// The details a moderator can edit. The code never changes; the condition has its own action
// with a reason (MF-29); onLoan only changes through loans. The rooms are edited too, but each
// room change gets its own event (see updateItem).
const EDITABLE_FIELDS = [
  'name',
  'categoryId',
  'brandId',
  'colourId',
  'hasWheels',
  'wheelCount',
  'notes',
];

// 02 › Edit item: the current room follows the loan while an item is on loan (M7 wording).
function itemOnLoan(code) {
  return new AppError(409, 'ITEM_ON_LOAN', 'Mark this item returned first', { itemCode: code });
}

// A room chosen on the Edit form must exist and not be archived.
async function checkRoom(roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { archived: true } });
  if (!room || room.archived) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Choose a room from the list.');
  }
}

// PATCH /api/items/:code. `changes` is already validated and holds only editable fields
// and the two rooms.
// - a changed home room → HOME_CHANGED event; a changed current room → LOCATION_CORRECTED;
//   both need a reason, saved as the event note (shown as the reason in Recent activity).
//   An unchanged room writes nothing, needs no reason and is not checked again.
// - the current room cannot change while the item is on loan → 409 ITEM_ON_LOAN.
// - the other details → one EDITED event with the names of the changed fields.
export async function updateItem(code, changes, userId) {
  const item = await prisma.item.findUnique({
    where: { code },
    select: {
      id: true,
      onLoan: true,
      homeRoomId: true,
      currentRoomId: true,
      ...Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, true])),
    },
  });
  if (!item) {
    throw itemNotFound(code);
  }

  const { homeRoomId, currentRoomId, reason, ...details } = changes;
  const homeChanged = homeRoomId !== undefined && homeRoomId !== item.homeRoomId;
  const currentChanged = currentRoomId !== undefined && currentRoomId !== item.currentRoomId;

  if (currentChanged && item.onLoan) {
    throw itemOnLoan(code);
  }
  if ((homeChanged || currentChanged) && !reason) {
    throw new AppError(400, 'VALIDATION_ERROR', 'reason: is required when a room changes');
  }
  if (homeChanged) {
    await checkRoom(homeRoomId);
  }
  if (currentChanged && currentRoomId !== homeRoomId) {
    await checkRoom(currentRoomId);
  }

  if (details.categoryId) {
    await checkActive(prisma.category, details.categoryId, 'Category');
  }
  if (details.brandId) {
    await checkActive(prisma.brand, details.brandId, 'Brand');
  }
  if (details.colourId) {
    await checkActive(prisma.colour, details.colourId, 'Colour');
  }

  const next = { ...item, ...details };
  next.notes = next.notes || null;

  // Wheels rule, checked on the result: the request may change only one of the two fields.
  if (!next.hasWheels) {
    next.wheelCount = null;
  } else if (!next.wheelCount) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'wheelCount: is required (1–12) when the item has wheels',
    );
  }

  // An emptied name falls back to the category name, as when creating.
  if (!next.name) {
    const category = await prisma.category.findUnique({
      where: { id: next.categoryId },
      select: { name: true },
    });
    next.name = category.name;
  }

  const changed = EDITABLE_FIELDS.filter((field) => next[field] !== item[field]);
  if (changed.length === 0 && !homeChanged && !currentChanged) {
    return getItem(code);
  }

  const data = Object.fromEntries(changed.map((field) => [field, next[field]]));
  if (homeChanged) {
    data.homeRoomId = homeRoomId;
  }
  if (currentChanged) {
    data.currentRoomId = currentRoomId;
  }

  // Item history: one event per kind of change (field names only, no user text).
  const events = [];
  if (changed.length > 0) {
    events.push({ type: 'EDITED', note: `Changed: ${changed.join(', ')}` });
  }
  if (homeChanged) {
    events.push({
      type: 'HOME_CHANGED',
      fromRoomId: item.homeRoomId,
      toRoomId: homeRoomId,
      note: reason,
    });
  }
  if (currentChanged) {
    events.push({
      type: 'LOCATION_CORRECTED',
      fromRoomId: item.currentRoomId,
      toRoomId: currentRoomId,
      note: reason,
    });
  }

  await prisma.$transaction(async (tx) => {
    // When the current room changes, the update only matches while the item is still not on
    // loan, so a loan approved since the check above cannot be overwritten.
    const { count } = await tx.item.updateMany({
      where: currentChanged ? { id: item.id, onLoan: false } : { id: item.id },
      data,
    });
    if (count === 0) {
      throw itemOnLoan(code);
    }
    await tx.itemEvent.createMany({
      data: events.map((event) => ({ itemId: item.id, userId, ...event })),
    });
  });

  return getItem(code);
}
