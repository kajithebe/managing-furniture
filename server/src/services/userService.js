// User changes. A user's own data is found by the id from the session, never from the request.
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { logChange } from './auditService.js';
import { assertAllowedEmail, nameFromEmail, publicUser } from './authService.js';

export async function updateOwnName(userId, name) {
  const user = await prisma.user.update({ where: { id: userId }, data: { name } });
  return publicUser(user);
}

// A2 Users (admin). The fields one table row shows.
const userRowFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  lastLoginAt: true,
  // "Open loans" column: only loans that are still open.
  _count: { select: { loans: { where: { status: 'OPEN' } } } },
};

function toRow({ _count, ...user }) {
  return { ...user, openLoans: _count.loans };
}

// The sort arrows on A2. Open loans is sorted separately (see listUsers).
export const USER_SORT_COLUMNS = ['name', 'email', 'role', 'status', 'lastLogin', 'openLoans'];

// The id is always added last, so rows with the same value keep a stable order across pages.
// Users added in advance have no name or last login yet: those rows go last.
function orderBy(sort, order) {
  const columns = {
    name: [{ name: { sort: order, nulls: 'last' } }],
    email: [{ email: order }],
    role: [{ role: order }],
    status: [{ active: order }],
    lastLogin: [{ lastLoginAt: { sort: order, nulls: 'last' } }],
  };
  return [...columns[sort], { id: 'asc' }];
}

// GET /api/admin/users (A2): search on name or email, Role and Status filters, sorting, paging.
// activeAdmins lets the page show "At least one active admin is needed" before a click.
export async function listUsers({ q, role, status, sort, order, page, pageSize }) {
  const conditions = [];
  if (q) {
    conditions.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (role) {
    conditions.push({ role });
  }
  if (status) {
    conditions.push({ active: status === 'ACTIVE' });
  }
  const where = { AND: conditions };

  const [total, activeAdmins] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: 'ADMIN', active: true } }),
  ]);

  let rows;
  if (sort === 'openLoans') {
    // The database cannot sort by a filtered count, so the counts of all matching users are
    // sorted here (a few hundred users at Metropolia), then only one page is returned.
    const all = await prisma.user.findMany({
      where,
      select: userRowFields,
      orderBy: { id: 'asc' },
    });
    const direction = order === 'asc' ? 1 : -1;
    rows = all
      .sort((a, b) => (a._count.loans - b._count.loans) * direction || a.id - b.id)
      .slice((page - 1) * pageSize, page * pageSize);
  } else {
    rows = await prisma.user.findMany({
      where,
      select: userRowFields,
      orderBy: orderBy(sort, order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  return { data: rows.map(toRow), total, activeAdmins };
}

// P14 has no wording for an address that is already in use (proposed in MF-24, see 02).
function emailTaken(email, existing) {
  return new AppError(409, 'EMAIL_TAKEN', `${email} already has an account`, {
    existing: { id: existing.id, name: existing.name },
  });
}

// POST /api/admin/users (P14 Add user): add a user in advance with a role. They log in later
// with a code sent to this email. Without a name, the name is taken from the email, as on
// first login. The user and its AuditLog row are saved together.
export async function createUser(actorId, { email, name, role }) {
  // Same check and wording as login: "Use your @metropolia.fi address".
  // "@metropolia.fi" alone has no name part, so it gets the same message.
  assertAllowedEmail(email);
  if (email.indexOf('@') < 1) {
    assertAllowedEmail('');
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, name: true },
      });
      if (existing) {
        throw emailTaken(email, existing);
      }

      const created = await tx.user.create({
        data: { email, name: name || nameFromEmail(email), role },
        select: userRowFields,
      });
      await logChange(tx, {
        actorId,
        entity: 'User',
        entityId: created.id,
        action: 'create',
        after: { email: created.email, name: created.name, role: created.role },
      });
      return created;
    });
    return toRow(user);
  } catch (err) {
    // Two admins adding the same email at the same moment: the unique index stops the second.
    if (err.code === 'P2002') {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
      });
      throw emailTaken(email, existing ?? { id: null, name: null });
    }
    throw err;
  }
}
