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

// Checks that a referenced category, brand, colour or room exists and is not archived.
async function checkActive(model, id, label) {
  const row = await model.findUnique({ where: { id }, select: { archived: true, name: true } });
  if (!row || row.archived) {
    throw new AppError(400, 'INVALID_REFERENCE', `${label} not found.`);
  }
  return row;
}

// `data` is already validated by the route. `userId` is the logged-in moderator (null until
// MF-07 is merged). Returns the created items, in code order.
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
