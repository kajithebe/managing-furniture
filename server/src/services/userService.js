// User changes. A user's own data is found by the id from the session, never from the request.
import { prisma } from '../db.js';
import { publicUser } from './authService.js';

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
