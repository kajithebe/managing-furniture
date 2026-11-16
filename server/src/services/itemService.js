// Items (01 › Adding and editing items, 02 › Asset codes).
// Creating items: one request can add 1–200 identical items (bulk add). All items, their codes
// and their CREATED events are saved in one transaction: either all of them or none.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { reserveCodes } from './codeService.js';

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

// GET /api/items/:code
export async function getItem(code) {
  const item = await prisma.item.findUnique({ where: { code }, select: itemDetailFields });
  if (!item) {
    throw new AppError(404, 'ITEM_NOT_FOUND', `Item ${code} not found.`);
  }
  return withStatus(item);
}

// GET /api/items: filters, search on code and name, paging. Disposed items are hidden
// unless the DISPOSED status is asked for.
export async function listItems({ category, room, status, q, page, pageSize }) {
  const where = {
    ...(category && { categoryId: category }),
    ...(room && { OR: [{ homeRoomId: room }, { currentRoomId: room }] }),
    ...(status ? statusWhere(status) : { condition: { not: 'DISPOSED' } }),
    ...(q && {
      AND: [
        {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.item.findMany({
      where,
      select: itemDetailFields,
      orderBy: { code: 'asc' },
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

// The details a moderator can edit. The code never changes; condition, current room and
// home room have their own actions with a reason (MF-29); onLoan only changes through loans.
const EDITABLE_FIELDS = [
  'name',
  'categoryId',
  'brandId',
  'colourId',
  'hasWheels',
  'wheelCount',
  'notes',
];

// PATCH /api/items/:code. `changes` is already validated and holds only editable fields.
export async function updateItem(code, changes, userId) {
  const item = await prisma.item.findUnique({
    where: { code },
    select: { id: true, ...Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, true])) },
  });
  if (!item) {
    throw new AppError(404, 'ITEM_NOT_FOUND', `Item ${code} not found.`);
  }

  if (changes.categoryId) {
    await checkActive(prisma.category, changes.categoryId, 'Category');
  }
  if (changes.brandId) {
    await checkActive(prisma.brand, changes.brandId, 'Brand');
  }
  if (changes.colourId) {
    await checkActive(prisma.colour, changes.colourId, 'Colour');
  }

  const next = { ...item, ...changes };
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
  if (changed.length === 0) {
    return getItem(code);
  }

  await prisma.$transaction([
    prisma.item.update({
      where: { id: item.id },
      data: Object.fromEntries(changed.map((field) => [field, next[field]])),
    }),
    // Item history: which fields changed (names only, no user text).
    prisma.itemEvent.create({
      data: { itemId: item.id, type: 'EDITED', userId, note: `Changed: ${changed.join(', ')}` },
    }),
  ]);

  return getItem(code);
}
