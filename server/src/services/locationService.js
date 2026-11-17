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

// Returns the parent's name for the messages below.
async function checkParent(model, id, label) {
  const parent = await model.findUnique({ where: { id }, select: { archived: true, name: true } });
  if (!parent || parent.archived) {
    throw new AppError(400, 'INVALID_PARENT', `${label} not found.`);
  }
  return parent;
}

// P5: a building with this name in the campus. Returns the error, or null.
async function findDuplicateBuilding(campusId, name, campusName) {
  const existing = await prisma.building.findFirst({
    where: { campusId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true, campusId: true },
  });
  return existing
    ? new AppError(409, 'DUPLICATE_NAME', `${existing.name} already exists in ${campusName}`, {
        existing,
      })
    : null;
}

// P6: "D575 already exists in building D", with the room for the "Use D575" button.
async function findDuplicateRoom(buildingId, name, buildingName) {
  const existing = await prisma.room.findFirst({
    where: { buildingId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true, buildingId: true },
  });
  return existing
    ? new AppError(
        409,
        'DUPLICATE_NAME',
        `${existing.name} already exists in building ${buildingName}`,
        { existing },
      )
    : null;
}

// `actorId` is the logged-in moderator or admin.
export async function createBuilding({ campusId, name }, actorId) {
  const campus = await checkParent(prisma.campus, campusId, 'Campus');

  const duplicate = await findDuplicateBuilding(campusId, name, campus.name);
  if (duplicate) {
    throw duplicate;
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
    // Saved by someone else at the same moment: look again for the right message.
    if (err.code === 'P2002') {
      throw (await findDuplicateBuilding(campusId, name, campus.name)) ?? err;
    }
    throw err;
  }
}

export async function createRoom({ buildingId, name }, actorId) {
  const building = await checkParent(prisma.building, buildingId, 'Building');

  const duplicate = await findDuplicateRoom(buildingId, name, building.name);
  if (duplicate) {
    throw duplicate;
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
      throw (await findDuplicateRoom(buildingId, name, building.name)) ?? err;
    }
    throw err;
  }
}
