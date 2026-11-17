// Moderator approvals (MF-10, M2 Requests). Items whose category needs a moderator wait as
// PENDING; a moderator approves or declines each item on its own (01 › Core rules).
import { prisma } from '../db.js';
import { roomsById } from './loanService.js';

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
