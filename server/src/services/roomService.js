// Rooms by door QR (MF-19, 02 › Return). S8 checks the scanned room before step 2, and S12
// (BASE_URL/r/<qrToken>) shows "Room D569 · Karaportti · Building D".
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';

// GET /api/rooms/by-qr/:qrToken. Archived rooms are still found: their door sticker may still
// be on the wall. The token itself is never sent back (02 › Security).
export async function roomByQrToken(qrToken) {
  const room = await prisma.room.findUnique({
    where: { qrToken },
    select: {
      id: true,
      name: true,
      building: {
        select: { id: true, name: true, campus: { select: { id: true, name: true } } },
      },
    },
  });
  if (!room) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  }

  return {
    id: room.id,
    name: room.name,
    building: { id: room.building.id, name: room.building.name },
    campus: room.building.campus,
  };
}
