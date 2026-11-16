// "+ Add new" for buildings and rooms (campuses use listService, because they have a short code).
// A building name is unique within its campus, a room name within its building,
// ignoring upper and lower case. New entries can only be added under non-archived parents.
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';

// 02 › Security: room QR tokens are random (16 characters), never the room name.
function newQrToken() {
  return randomBytes(12).toString('base64url');
}

async function checkParent(model, id, label) {
  const parent = await model.findUnique({ where: { id }, select: { archived: true } });
  if (!parent || parent.archived) {
    throw new AppError(400, 'INVALID_PARENT', `${label} not found.`);
  }
}

function duplicateName(name) {
  return new AppError(409, 'DUPLICATE_NAME', `"${name}" already exists.`);
}

export async function createBuilding({ campusId, name }) {
  await checkParent(prisma.campus, campusId, 'Campus');

  const same = await prisma.building.findFirst({
    where: { campusId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (same) {
    throw duplicateName(name);
  }

  try {
    return await prisma.building.create({
      data: { campusId, name },
      select: { id: true, name: true, campusId: true },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw duplicateName(name);
    }
    throw err;
  }
}

export async function createRoom({ buildingId, name }) {
  await checkParent(prisma.building, buildingId, 'Building');

  const same = await prisma.room.findFirst({
    where: { buildingId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (same) {
    throw duplicateName(name);
  }

  try {
    // qrToken is not returned: door labels (MF-09) read it from the database.
    return await prisma.room.create({
      data: { buildingId, name, qrToken: newQrToken() },
      select: { id: true, name: true, buildingId: true },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw duplicateName(name);
    }
    throw err;
  }
}
