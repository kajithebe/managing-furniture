// Data for the M8 "Print labels" page (MF-09). The page lays out the A4 sheet; this service gives
// the text of each label and its QR image.
// Item label: QR, code, name, "Home: D569"
// Room label: QR, room name, "Karaportti · Building D"
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { itemQrUrl, qrDataUrl, roomQrUrl } from './qrService.js';

// One label per selected item, in the order the moderator selected them.
export async function itemLabels(codes) {
  const items = await prisma.item.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      name: true,
      homeRoom: { select: { id: true, name: true } },
    },
  });

  const byCode = new Map(items.map((item) => [item.code, item]));
  const missing = codes.find((code) => !byCode.has(code));
  if (missing) {
    // Same wording as S5 "No item with code MP-99999".
    throw new AppError(404, 'ITEM_NOT_FOUND', `No item with code ${missing}`, {
      itemCode: missing,
    });
  }

  return {
    data: await Promise.all(
      codes.map(async (code) => {
        const item = byCode.get(code);
        return {
          code: item.code,
          name: item.name,
          homeRoom: item.homeRoom,
          qrImage: await qrDataUrl(itemQrUrl(item.code)),
        };
      }),
    ),
  };
}

// One label per selected room. Archived rooms can still be printed (a replacement door label).
export async function roomLabels(ids) {
  const rooms = await prisma.room.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      qrToken: true,
      building: {
        select: { id: true, name: true, campus: { select: { id: true, name: true } } },
      },
    },
  });

  const byId = new Map(rooms.map((room) => [room.id, room]));
  if (ids.some((id) => !byId.has(id))) {
    throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  }

  return {
    data: await Promise.all(
      ids.map(async (id) => {
        const { name, qrToken, building } = byId.get(id);
        // qrToken itself is not returned: it is only inside the QR image (02 › Security).
        return {
          id,
          name,
          building: { id: building.id, name: building.name },
          campus: building.campus,
          qrImage: await qrDataUrl(roomQrUrl(qrToken)),
        };
      }),
    ),
  };
}
