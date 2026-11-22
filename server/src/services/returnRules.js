// Return rules (MF-19, 02 › Return, 02 › Loan item rules).
// Plain functions without database access, so the rules are easy to test.
// Error texts follow the design: S8 (scan the room) and S9 (scan each item).
import { AppError } from '../middleware/error.js';

// Items the borrower still has: these can be scanned back.
const RETURNABLE = ['APPROVED', 'OVERDUE'];

// A loan stays open while any item is waiting, on loan or not yet returned.
const OPEN = ['PENDING', 'APPROVED', 'OVERDUE'];

export function isReturnable(loanItem) {
  return RETURNABLE.includes(loanItem.status);
}

// True when no item of the loan is still open, so the loan can be closed.
export function shouldClose(statuses) {
  return !statuses.some((status) => OPEN.includes(status));
}

function roomOf(room) {
  return { id: room.id, name: room.name };
}

// Checks one return call and gives back the loan items to return now.
// `loan`: { status, items: [{ id, status, item: { code, homeRoom: { id, name } } }] }
// `room`: the scanned or typed room { id, name }
// `itemCodes`: upper-cased codes, each once.
// The whole call is refused when one item fails (same as borrowing), so the first problem
// is thrown and nothing is returned. Items already returned are skipped without an error,
// so scanning the same chair twice is harmless.
export function checkReturn(loan, room, itemCodes) {
  if (loan.status === 'CLOSED') {
    throw new AppError(409, 'LOAN_CLOSED', 'This loan is already closed.');
  }

  // S8: the room must be the home room of at least one item the borrower still has.
  const returnable = loan.items.filter(isReturnable);
  if (returnable.length > 0 && !returnable.some((li) => li.item.homeRoom.id === room.id)) {
    const homeRoom = returnable[0].item.homeRoom;
    throw new AppError(
      409,
      'WRONG_ROOM',
      `This is ${room.name}. These items belong in ${homeRoom.name}.`,
      { room: roomOf(room), homeRoom: roomOf(homeRoom) },
    );
  }

  const toReturn = [];
  for (const itemCode of itemCodes) {
    const loanItem = loan.items.find((li) => li.item.code === itemCode);

    // S9: an unknown code, an item of another loan, or a declined item.
    if (!loanItem || loanItem.status === 'DECLINED') {
      throw new AppError(409, 'ITEM_NOT_IN_LOAN', `${itemCode} is not part of this loan`, {
        itemCode,
      });
    }
    if (loanItem.status === 'PENDING') {
      throw new AppError(409, 'ITEM_NOT_ON_LOAN', `${itemCode} is still waiting for approval`, {
        itemCode,
      });
    }
    if (loanItem.status === 'RETURNED') {
      continue;
    }

    // S9: this item belongs in another room.
    const homeRoom = loanItem.item.homeRoom;
    if (homeRoom.id !== room.id) {
      throw new AppError(
        409,
        'ITEM_WRONG_HOME_ROOM',
        `${itemCode} belongs in ${homeRoom.name}, not ${room.name}`,
        { itemCode, homeRoom: roomOf(homeRoom), room: roomOf(room) },
      );
    }

    toReturn.push(loanItem);
  }
  return toReturn;
}
