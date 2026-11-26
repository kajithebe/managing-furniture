// Returning items (MF-19, 02 › Return). The borrower scans the home room's door QR,
// then each item; every call returns the scanned items at once, so a "Returned ✓" tick on S9
// is already saved. The checks and their texts are in returnRules.js.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { loanFields, loanViews } from './loanService.js';
import { checkReturn, isReturnable, shouldClose } from './returnRules.js';

// What the return checks need about the loan and its items.
const returnFields = {
  id: true,
  status: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      item: {
        select: {
          id: true,
          code: true,
          currentRoomId: true,
          homeRoom: { select: { id: true, name: true } },
        },
      },
    },
  },
};

// POST /api/loans/:id/return. Only the logged-in user's own loan: another user's loan is
// "not found", so loan ids cannot be probed. The reply is the loan in the Loan shape (S9, S10).
export async function returnItems(userId, loanId, { roomQrToken, roomId, itemCodes }) {
  const returnedAt = new Date();

  // One transaction: the items, their moves, the history and closing the loan are saved
  // together, or nothing is saved.
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, userId }, select: returnFields });
    if (!loan) {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }

    // The scanned door QR, or the room typed on S8 ("Type the room instead").
    const room = await tx.room.findUnique({
      where: roomQrToken ? { qrToken: roomQrToken } : { id: roomId },
      select: { id: true, name: true },
    });
    if (!room) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found.');
    }

    const toReturn = checkReturn(loan, room, itemCodes);

    const events = [];
    for (const loanItem of toReturn) {
      // Only an item that is still on loan changes, so a moderator marking it returned
      // at the same moment cannot make it returned twice.
      const { count } = await tx.loanItem.updateMany({
        where: { id: loanItem.id, status: { in: ['APPROVED', 'OVERDUE'] } },
        data: { status: 'RETURNED', returnMethod: 'SCAN', returnedAt, returnedById: userId },
      });
      if (count === 0) {
        continue;
      }

      // Back home and free to borrow. The condition is not touched, so a "Needs repair"
      // chair stays "Needs repair" (01 › Core rules).
      await tx.item.update({
        where: { id: loanItem.item.id },
        data: { onLoan: false, currentRoomId: loanItem.item.homeRoom.id },
      });
      events.push({
        itemId: loanItem.item.id,
        type: 'RETURNED',
        userId,
        loanId: loan.id,
        fromRoomId: loanItem.item.currentRoomId,
        toRoomId: loanItem.item.homeRoom.id,
      });
    }

    if (events.length > 0) {
      await tx.itemEvent.createMany({ data: events });

      // A partial return keeps the loan open; it closes when nothing is open any more.
      const items = await tx.loanItem.findMany({ where: { loanId }, select: { status: true } });
      if (shouldClose(items.map((item) => item.status))) {
        await tx.loan.update({
          where: { id: loanId },
          data: { status: 'CLOSED', closedAt: returnedAt },
        });
      }
    }
  });

  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, select: loanFields });
  const [view] = await loanViews([loan]);
  return view;
}

// What a moderator's "Mark returned" needs about one loan item.
const markReturnedFields = {
  id: true,
  status: true,
  loanId: true,
  item: {
    select: {
      id: true,
      code: true,
      name: true,
      currentRoomId: true,
      category: { select: { name: true } },
      homeRoom: { select: { id: true, name: true } },
    },
  },
};

// 02 › Not yet returned: e.g. the student scanned the item back a moment before.
function alreadyReturned(code) {
  return new AppError(409, 'ALREADY_RETURNED', 'This item is already returned', {
    itemCode: code,
  });
}

// POST /api/moderator/loan-items/:id/mark-returned (MF-23, P12): a moderator confirms that
// one item is back, e.g. "Found in D751, moved back by caretaker". Works for items that are
// on loan or not yet returned. Same result as a scan (02 › Loan item rules): RETURNED with
// method MODERATOR, the item is free again and back in its home room, its condition is kept.
// The note goes into the item's history (MARKED_RETURNED event).
// The reply is for M4 and M7: the item, who returned it, and whether the loan is now closed.
export async function markReturned(loanItemId, moderator, { note }) {
  const returnedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const loanItem = await tx.loanItem.findUnique({
      where: { id: loanItemId },
      select: markReturnedFields,
    });
    if (!loanItem) {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }
    const { code } = loanItem.item;
    if (loanItem.status === 'PENDING') {
      throw new AppError(409, 'ITEM_NOT_ON_LOAN', `${code} is still waiting for approval`, {
        itemCode: code,
      });
    }
    if (loanItem.status === 'DECLINED') {
      throw new AppError(409, 'ITEM_NOT_ON_LOAN', `${code} was declined, so it isn't on loan`, {
        itemCode: code,
      });
    }
    if (!isReturnable(loanItem)) {
      throw alreadyReturned(code);
    }

    // Only an item that is still on loan changes, so a scan at the same moment cannot be
    // overwritten (returnItems uses the same check). If the scan was quicker: already returned.
    const { count } = await tx.loanItem.updateMany({
      where: { id: loanItem.id, status: { in: ['APPROVED', 'OVERDUE'] } },
      data: {
        status: 'RETURNED',
        returnMethod: 'MODERATOR',
        returnedAt,
        returnedById: moderator.id,
      },
    });
    if (count === 0) {
      throw alreadyReturned(code);
    }

    await tx.item.update({
      where: { id: loanItem.item.id },
      data: { onLoan: false, currentRoomId: loanItem.item.homeRoom.id },
    });
    await tx.itemEvent.create({
      data: {
        itemId: loanItem.item.id,
        type: 'MARKED_RETURNED',
        userId: moderator.id,
        loanId: loanItem.loanId,
        fromRoomId: loanItem.item.currentRoomId,
        toRoomId: loanItem.item.homeRoom.id,
        note: note ?? null,
      },
    });

    // The loan closes when this was its last open item.
    const items = await tx.loanItem.findMany({
      where: { loanId: loanItem.loanId },
      select: { status: true },
    });
    let loanStatus = 'OPEN';
    if (shouldClose(items.map((item) => item.status))) {
      await tx.loan.update({
        where: { id: loanItem.loanId },
        data: { status: 'CLOSED', closedAt: returnedAt },
      });
      loanStatus = 'CLOSED';
    }

    return {
      id: loanItem.id,
      status: 'RETURNED',
      code,
      name: loanItem.item.name,
      category: loanItem.item.category.name,
      returnedAt,
      returnMethod: 'MODERATOR',
      returnedBy: { id: moderator.id, name: moderator.name },
      note: note ?? null,
      loan: { id: loanItem.loanId, status: loanStatus },
    };
  });
}
