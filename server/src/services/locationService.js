// "+ Add new" for buildings and rooms (campuses use listService, because they have a short code).
// A building name is unique within its campus, a room name within its building,
// ignoring upper and lower case. New entries can only be added under non-archived parents.
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { logChange } from './auditService.js';

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

// `actorId` is the logged-in moderator or admin.
export async function createBuilding({ campusId, name }, actorId) {
  await checkParent(prisma.campus, campusId, 'Campus');

  const same = await prisma.building.findFirst({
    where: { campusId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (same) {
    throw duplicateName(name);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const building = await tx.building.create({
        data: { campusId, name },
        select: { id: true, name: true, campusId: true },
      });
      await logChange(tx, {
        actorId,
        entity: 'Building',
        entityId: building.id,
        action: 'create',
        after: building,
      });
      return building;
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw duplicateName(name);
    }
    throw err;
  }
}

export async function createRoom({ buildingId, name }, actorId) {
  await checkParent(prisma.building, buildingId, 'Building');

  const same = await prisma.room.findFirst({
    where: { buildingId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (same) {
    throw duplicateName(name);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // qrToken is not returned or logged: door labels (MF-09) read it from the database.
      const room = await tx.room.create({
        data: { buildingId, name, qrToken: newQrToken() },
        select: { id: true, name: true, buildingId: true },
      });
      await logChange(tx, {
        actorId,
        entity: 'Room',
        entityId: room.id,
        action: 'create',
        after: room,
      });
      return room;
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw duplicateName(name);
    }
    throw err;
  }
}
