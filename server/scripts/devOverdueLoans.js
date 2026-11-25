// Dev-only test data for MF-23 (Not yet returned): creates two loans that are already past
// their until-time, with their items marked OVERDUE ("Not yet returned"), so the M4 page,
// Mark returned and the report can be tried without waiting for a due time to pass.
// It writes the same data the MF-20 reminders job writes: LoanItem OVERDUE and one OVERDUE
// ItemEvent without a user; the item stays in the loan's room (its last known room).
// TODO: remove when MF-20 is merged, or keep as a dev tool (needs team agreement).
//
// Needs the demo items first:  npm run db:seed:demo
// Run with:                    npm run dev:overdue
// Never runs in production. Only fake people; emails go to Mailpit locally.
import { env } from '../src/config/env.js';
import { prisma } from '../src/db.js';
import { DEMO_NOTE } from '../prisma/demoItems.js';

const HOUR = 60 * 60 * 1000;

// Marks the loans this script creates, so it never adds a second set while they are open.
const DEMO_REASON = 'Demo late loan';

// Two borrowers, so M4 shows both "Last contacted" states and can be sorted and filtered.
// `lateHours`: how long ago the until-time was. `contactedHoursAgo`: null = never ("—").
const LATE_LOANS = [
  {
    borrower: { name: 'Aino Virtanen', local: 'aino.virtanen' },
    toRoom: 'D501',
    lateHours: 26,
    contactedHoursAgo: 1,
    items: [
      { category: 'CHR', fromRoom: 'D569' },
      { category: 'TBL', fromRoom: 'D569' },
    ],
  },
  {
    borrower: { name: 'Leo Korhonen', local: 'leo.korhonen' },
    toRoom: 'D504',
    lateHours: 3,
    contactedHoursAgo: null,
    items: [{ category: 'STL', fromRoom: 'D502' }],
  },
];

// Rounds down to the full hour, so the due time looks like one a student picks on S4.
function hoursAgo(hours, now) {
  const time = new Date(now.getTime() - hours * HOUR);
  time.setMinutes(0, 0, 0);
  return time;
}

// A free demo item of the category that is in `fromRoom` (Available or Needs repair, not on loan).
async function findFreeItem(tx, categoryCode, fromRoomId, usedIds) {
  return tx.item.findFirst({
    where: {
      notes: DEMO_NOTE,
      onLoan: false,
      condition: 'GOOD',
      currentRoomId: fromRoomId,
      category: { code: categoryCode },
      id: { notIn: usedIds },
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      code: true,
      currentRoomId: true,
      category: { select: { autoApprove: true } },
    },
  });
}

async function createLateLoan(tx, spec, rooms, moderatorId, now) {
  const borrower = await tx.user.upsert({
    where: { email: `${spec.borrower.local}@${env.ALLOWED_EMAIL_DOMAIN}` },
    update: {},
    create: {
      email: `${spec.borrower.local}@${env.ALLOWED_EMAIL_DOMAIN}`,
      name: spec.borrower.name,
    },
  });

  const dueAt = hoursAgo(spec.lateHours, now);
  const createdAt = new Date(dueAt.getTime() - 3 * HOUR);
  const toRoomId = rooms.get(spec.toRoom);

  const usedIds = [];
  const items = [];
  for (const wanted of spec.items) {
    const item = await findFreeItem(tx, wanted.category, rooms.get(wanted.fromRoom), usedIds);
    if (!item) {
      throw new Error(`No free demo ${wanted.category} in ${wanted.fromRoom}. Run db:seed:demo.`);
    }
    usedIds.push(item.id);
    items.push(item);
  }

  const loan = await tx.loan.create({
    data: { userId: borrower.id, toRoomId, reason: DEMO_REASON, dueAt, createdAt },
  });

  // First "not yet returned" email at the due time, then the 24 h repeat (MF-20 rules).
  const lastOverdueEmailAt = spec.lateHours >= 24 ? new Date(dueAt.getTime() + 24 * HOUR) : dueAt;
  const lastContactedAt =
    spec.contactedHoursAgo === null
      ? null
      : new Date(now.getTime() - spec.contactedHoursAgo * HOUR);

  for (const item of items) {
    const autoApproved = item.category.autoApprove;
    await tx.loanItem.create({
      data: {
        loanId: loan.id,
        itemId: item.id,
        fromRoomId: item.currentRoomId,
        status: 'OVERDUE',
        decidedById: autoApproved ? null : moderatorId,
        decidedAt: autoApproved ? null : createdAt,
        lastOverdueEmailAt,
        lastContactedAt,
      },
    });
    // On loan and moved to the loan's room, as after borrowing (loanService / approvalService).
    await tx.item.update({
      where: { id: item.id },
      data: { onLoan: true, currentRoomId: toRoomId },
    });
    await tx.itemEvent.createMany({
      data: [
        {
          itemId: item.id,
          type: 'BORROWED',
          userId: borrower.id,
          loanId: loan.id,
          fromRoomId: item.currentRoomId,
          toRoomId,
          createdAt,
        },
        // Written by the system (MF-20 job), so no user.
        { itemId: item.id, type: 'OVERDUE', loanId: loan.id, createdAt: dueAt },
      ],
    });
  }
  return items.length;
}

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('devOverdueLoans.js is for local development only.');
  }

  const open = await prisma.loan.count({ where: { reason: DEMO_REASON, status: 'OPEN' } });
  if (open > 0) {
    console.info(`Nothing added: ${open} demo late loans are still open.`);
    return;
  }

  const roomNames = LATE_LOANS.flatMap((l) => [l.toRoom, ...l.items.map((i) => i.fromRoom)]);
  const roomRows = await prisma.room.findMany({
    where: { name: { in: roomNames } },
    select: { id: true, name: true },
  });
  const rooms = new Map(roomRows.map((room) => [room.name, room.id]));
  const missing = roomNames.filter((name) => !rooms.has(name));
  if (missing.length > 0) {
    throw new Error(`Demo rooms missing: ${[...new Set(missing)].join(', ')}. Run db:seed:demo.`);
  }

  // "Decided by" for items that needed approval (Table): any moderator or admin.
  const moderator = await prisma.user.findFirst({
    where: { role: { in: ['MODERATOR', 'ADMIN'] }, active: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  const now = new Date();
  const added = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const spec of LATE_LOANS) {
      count += await createLateLoan(tx, spec, rooms, moderator?.id ?? null, now);
    }
    return count;
  });

  console.info(`Added ${LATE_LOANS.length} demo late loans with ${added} not yet returned items.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
