// Borrow requests (MF-10, 01 › Core rules, 02 › Loan item rules).
// A request holds several items with one until-time. Items whose category approves
// automatically are on loan at once; the others wait for a moderator.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { checkBorrowable, checkDueAt, initialStatus, itemNotFound } from './loanRules.js';

// What the screens show about a loan (S6 Request sent, S7 My loans).
const loanFields = {
  id: true,
  reason: true,
  dueAt: true,
  status: true,
  createdAt: true,
  closedAt: true,
  toRoomId: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      fromRoomId: true,
      item: {
        select: {
          code: true,
          name: true,
          condition: true,
          category: { select: { name: true } },
          homeRoom: { select: { id: true, name: true } },
        },
      },
    },
  },
};

// Loan.toRoomId and LoanItem.fromRoomId are plain ids (02 › data model),
// so their room names are loaded in one extra query.
async function roomsById(ids) {
  const rooms = await prisma.room.findMany({
    where: { id: { in: [...new Set(ids.filter(Boolean))] } },
    select: { id: true, name: true },
  });
  return new Map(rooms.map((room) => [room.id, room]));
}

function loanView(loan, rooms) {
  return {
    id: loan.id,
    status: loan.status,
    reason: loan.reason,
    dueAt: loan.dueAt,
    createdAt: loan.createdAt,
    closedAt: loan.closedAt,
    toRoom: rooms.get(loan.toRoomId) ?? null,
    items: loan.items.map((loanItem) => ({
      id: loanItem.id,
      status: loanItem.status,
      code: loanItem.item.code,
      name: loanItem.item.name,
      category: loanItem.item.category.name,
      condition: loanItem.item.condition,
      homeRoom: loanItem.item.homeRoom,
      fromRoom: rooms.get(loanItem.fromRoomId) ?? null,
    })),
  };
}

// Turns loans from the database into what the API returns.
export async function loanViews(loans) {
  const rooms = await roomsById(
    loans.flatMap((loan) => [loan.toRoomId, ...loan.items.map((item) => item.fromRoomId)]),
  );
  return loans.map((loan) => loanView(loan, rooms));
}

// POST /api/loans
export async function createLoan(userId, { itemCodes, toRoomId, dueAt, reason }) {
  const setting = await prisma.setting.findUniqueOrThrow({
    where: { id: 1 },
    select: { maxLoanHours: true },
  });
  checkDueAt(dueAt, setting.maxLoanHours);

  // One transaction: the loan, its items, the item moves and the history are saved together,
  // or nothing is saved.
  const loanId = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findFirst({
      where: { id: toRoomId, archived: false },
      select: { id: true },
    });
    if (!room) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Choose a room from the list.');
    }

    const found = await tx.item.findMany({
      where: { code: { in: itemCodes } },
      select: {
        id: true,
        code: true,
        onLoan: true,
        condition: true,
        currentRoomId: true,
        category: { select: { autoApprove: true } },
      },
    });
    // Same order as in the request.
    const items = itemCodes.map((code) => found.find((item) => item.code === code));
    const missing = itemCodes.find((code, index) => !items[index]);
    if (missing) {
      throw itemNotFound(missing);
    }
    checkBorrowable(items);

    const loan = await tx.loan.create({
      data: {
        userId,
        toRoomId,
        dueAt,
        reason,
        items: {
          create: items.map((item) => ({
            itemId: item.id,
            fromRoomId: item.currentRoomId,
            status: initialStatus(item),
          })),
        },
      },
      select: { id: true },
    });

    // Auto-approved items are on loan now and move to the target room. The update only
    // succeeds while the item is still free, so two students can never get the same chair.
    const approved = items.filter((item) => initialStatus(item) === 'APPROVED');
    for (const item of approved) {
      const { count } = await tx.item.updateMany({
        where: { id: item.id, onLoan: false },
        data: { onLoan: true, currentRoomId: toRoomId },
      });
      if (count === 0) {
        checkBorrowable([{ ...item, onLoan: true }]);
      }
    }

    // Item history: only items that moved get an event now; waiting items get theirs
    // when a moderator decides.
    if (approved.length > 0) {
      await tx.itemEvent.createMany({
        data: approved.map((item) => ({
          itemId: item.id,
          type: 'BORROWED',
          userId,
          loanId: loan.id,
          fromRoomId: item.currentRoomId,
          toRoomId,
          note: reason,
        })),
      });
    }

    return loan.id;
  });

  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, select: loanFields });
  const [view] = await loanViews([loan]);
  return view;
}

// How many closed loans S7 shows under "Recent loans".
const RECENT_LOANS = 5;

// GET /api/loans/mine (S7 My loans): the user's open loans, the one due first on top,
// then their last 5 closed loans, newest first. Only the logged-in user's own loans.
export async function listMyLoans(userId) {
  const [open, recent] = await Promise.all([
    prisma.loan.findMany({
      where: { userId, status: 'OPEN' },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      select: loanFields,
    }),
    prisma.loan.findMany({
      where: { userId, status: 'CLOSED' },
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      take: RECENT_LOANS,
      select: loanFields,
    }),
  ]);

  const views = await loanViews([...open, ...recent]);
  return { open: views.slice(0, open.length), recent: views.slice(open.length) };
}
