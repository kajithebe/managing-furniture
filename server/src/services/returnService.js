// Returning items (MF-19, 02 › Return). The borrower scans the home room's door QR,
// then each item; every call returns the scanned items at once, so a "Returned ✓" tick on S9
// is already saved. The checks and their texts are in returnRules.js.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { loanFields, loanViews } from './loanService.js';
import { checkReturn, shouldClose } from './returnRules.js';

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
export async function returnItems(userId, loanId, { roomQrToken, itemCodes }) {
  const returnedAt = new Date();

  // One transaction: the items, their moves, the history and closing the loan are saved
  // together, or nothing is saved.
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, userId }, select: returnFields });
    if (!loan) {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }

    const room = await tx.room.findUnique({
      where: { qrToken: roomQrToken },
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
