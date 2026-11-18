// Moderator approvals (MF-10, M2 Requests). Items whose category needs a moderator wait as
// PENDING; a moderator approves or declines each item on its own (01 › Core rules).
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { requestDecidedMail } from '../mail/requestDecided.js';
import { AppError } from '../middleware/error.js';
import { checkBorrowable } from './loanRules.js';
import { roomsById } from './loanService.js';
import { sendMail } from './mailService.js';

// GET /api/moderator/requests (M2 Waiting tab): every open request with at least one waiting
// item, oldest first, so the one waiting longest is on top. Each request lists its waiting
// items and the items already approved in it ("Already approved in this request").
export async function listWaitingRequests() {
  const loans = await prisma.loan.findMany({
    where: { status: 'OPEN', items: { some: { status: 'PENDING' } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      reason: true,
      dueAt: true,
      createdAt: true,
      toRoomId: true,
      user: { select: { id: true, name: true } },
      items: {
        where: { status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          status: true,
          fromRoomId: true,
          decidedById: true,
          item: { select: { code: true, name: true, category: { select: { name: true } } } },
        },
      },
    },
  });

  const rooms = await roomsById(
    loans.flatMap((loan) => [loan.toRoomId, ...loan.items.map((item) => item.fromRoomId)]),
  );

  const data = loans.map((loan) => {
    const items = loan.items.map((loanItem) => ({
      id: loanItem.id,
      code: loanItem.item.code,
      name: loanItem.item.name,
      category: loanItem.item.category.name,
      fromRoom: rooms.get(loanItem.fromRoomId) ?? null,
      // Approved without a moderator = approved automatically by its category.
      autoApproved: loanItem.status === 'APPROVED' && loanItem.decidedById === null,
      status: loanItem.status,
    }));
    return {
      id: loan.id,
      borrower: loan.user,
      toRoom: rooms.get(loan.toRoomId) ?? null,
      dueAt: loan.dueAt,
      reason: loan.reason,
      createdAt: loan.createdAt,
      waiting: items.filter((item) => item.status === 'PENDING'),
      approved: items.filter((item) => item.status === 'APPROVED'),
    };
  });

  return {
    data,
    total: data.length,
    // The "Requests" count in the side menu: waiting items, not requests.
    waitingItems: data.reduce((sum, request) => sum + request.waiting.length, 0),
  };
}

// --- M2 "Decided today" tab ---

// Rows per page, as on the other moderator tables (M5).
export const DECIDED_PAGE_SIZE = 25;

// Midnight today in the app's time zone (TZ, Europe/Helsinki), as a Date. The server may run
// in UTC (Render), so "today" is worked out in that zone, not in the server's own.
export function startOfToday(timeZone = env.TZ, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, Number(value)]),
  );
  // How far the zone is ahead of UTC right now, e.g. +2 h in Helsinki in winter.
  const offset =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offset);
}

// GET /api/moderator/requests?tab=decided (M2 "Decided today"): items a moderator approved or
// declined since midnight, newest first. Auto-approved items are not decisions, so they are not
// listed (they have no decidedById).
export async function listDecidedToday({ page }) {
  const where = { decidedById: { not: null }, decidedAt: { gte: startOfToday() } };
  const [rows, total] = await Promise.all([
    prisma.loanItem.findMany({
      where,
      orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * DECIDED_PAGE_SIZE,
      take: DECIDED_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        decidedAt: true,
        decidedById: true,
        decisionNote: true,
        item: { select: { code: true, name: true, category: { select: { name: true } } } },
        loan: { select: { id: true, toRoomId: true, user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.loanItem.count({ where }),
  ]);

  // decidedById has no relation in the schema, so the moderators' names are read in one query.
  const [rooms, moderators] = await Promise.all([
    roomsById(rows.map((row) => row.loan.toRoomId)),
    usersById(rows.map((row) => row.decidedById)),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.item.code,
      name: row.item.name,
      category: row.item.category.name,
      // The status the item had right after the decision. A returned item was approved.
      decision: row.status === 'DECLINED' ? 'DECLINED' : 'APPROVED',
      note: row.decisionNote,
      decidedAt: row.decidedAt,
      decidedBy: moderators.get(row.decidedById) ?? null,
      loan: {
        id: row.loan.id,
        borrower: row.loan.user,
        toRoom: rooms.get(row.loan.toRoomId) ?? null,
      },
    })),
    total,
  };
}

// Names of users by id (moderators who decided, people who marked items returned).
export async function usersById(ids) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids.filter(Boolean))] } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

// --- Approve and decline (M2 actions, P10 Decline pop-up, email 2) ---

// What is read from the database to decide one item and write its email.
const decisionFields = {
  id: true,
  status: true,
  fromRoomId: true,
  loan: {
    select: {
      id: true,
      reason: true,
      dueAt: true,
      toRoomId: true,
      user: { select: { email: true, name: true } },
    },
  },
  item: {
    select: {
      id: true,
      code: true,
      name: true,
      onLoan: true,
      condition: true,
      homeRoomId: true,
      category: { select: { name: true } },
    },
  },
};

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Not found.');
}

function alreadyDecided() {
  return new AppError(409, 'ALREADY_DECIDED', 'This item has already been approved or declined.');
}

// A loan is closed when none of its items are waiting, on loan or not yet returned (02).
async function closeLoanIfDone(tx, loanId) {
  const open = await tx.loanItem.count({
    where: { loanId, status: { in: ['PENDING', 'APPROVED', 'OVERDUE'] } },
  });
  if (open === 0) {
    await tx.loan.update({
      where: { id: loanId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
}

// POST /api/moderator/loan-items/:id/approve and /decline.
// One item at a time: a declined item never cancels the others in the request (01 › Core rules).
export async function decideLoanItem(loanItemId, moderator, { approve, note }) {
  const decidedAt = new Date();

  const loanItem = await prisma.$transaction(async (tx) => {
    const found = await tx.loanItem.findUnique({
      where: { id: loanItemId },
      select: decisionFields,
    });
    if (!found) {
      throw notFound();
    }
    if (found.status !== 'PENDING') {
      throw alreadyDecided();
    }
    if (approve) {
      // The item may have been borrowed by someone else, or broken, since the request was sent.
      checkBorrowable([found.item]);
    }

    // Only a waiting item changes, so two moderators clicking at the same moment
    // cannot both decide it.
    const { count } = await tx.loanItem.updateMany({
      where: { id: loanItemId, status: 'PENDING' },
      data: {
        status: approve ? 'APPROVED' : 'DECLINED',
        decidedById: moderator.id,
        decidedAt,
        decisionNote: note ?? null,
      },
    });
    if (count === 0) {
      throw alreadyDecided();
    }

    if (approve) {
      // On loan now and moved to the target room, only while the item is still free.
      const moved = await tx.item.updateMany({
        where: { id: found.item.id, onLoan: false },
        data: { onLoan: true, currentRoomId: found.loan.toRoomId },
      });
      if (moved.count === 0) {
        checkBorrowable([{ ...found.item, onLoan: true }]);
      }
    }

    await tx.itemEvent.create({
      data: {
        itemId: found.item.id,
        type: approve ? 'APPROVED' : 'DECLINED',
        userId: moderator.id,
        loanId: found.loan.id,
        fromRoomId: approve ? found.fromRoomId : null,
        toRoomId: approve ? found.loan.toRoomId : null,
        note: note ?? null,
      },
    });

    if (!approve) {
      await closeLoanIfDone(tx, found.loan.id);
    }
    return found;
  });

  await sendDecisionEmail(loanItem, moderator, { approve, note });

  return {
    id: loanItem.id,
    status: approve ? 'APPROVED' : 'DECLINED',
    code: loanItem.item.code,
    name: loanItem.item.name,
    category: loanItem.item.category.name,
    decidedAt,
    decidedBy: { id: moderator.id, name: moderator.name },
    note: note ?? null,
  };
}

// Email 2 to the borrower. The decision is already saved, so a mail problem must not undo it:
// it is reported in the server log (without addresses or notes) and the moderator still sees
// the decision.
async function sendDecisionEmail(loanItem, moderator, { approve, note }) {
  try {
    const rooms = await roomsById([
      loanItem.fromRoomId,
      loanItem.loan.toRoomId,
      loanItem.item.homeRoomId,
    ]);
    const otherApprovedCount = approve
      ? 0
      : await prisma.loanItem.count({
          where: { loanId: loanItem.loan.id, status: 'APPROVED', id: { not: loanItem.id } },
        });
    const mail = requestDecidedMail({
      userName: loanItem.loan.user.name,
      approved: approve,
      item: { code: loanItem.item.code, categoryName: loanItem.item.category.name },
      fromRoom: rooms.get(loanItem.fromRoomId)?.name ?? '',
      toRoom: rooms.get(loanItem.loan.toRoomId)?.name ?? '',
      homeRoom: rooms.get(loanItem.item.homeRoomId)?.name ?? '',
      reason: loanItem.loan.reason,
      dueAt: loanItem.loan.dueAt,
      note,
      moderatorName: moderator.name,
      otherApprovedCount,
    });
    await sendMail({ to: loanItem.loan.user.email, ...mail });
  } catch (err) {
    console.error(`Decision email for loan item ${loanItem.id} could not be sent: ${err.message}`);
  }
}
