// Access control (02 › Security): every API route uses requireAuth;
// moderator and admin routes also use requireRole. Hiding a button in the UI is not protection.
import { prisma } from '../db.js';
import { endSession, readSession } from '../services/sessionService.js';
import { AppError } from './error.js';

// Higher number = more rights. Admins can do everything moderators can.
const ROLE_RANK = { USER: 0, MODERATOR: 1, ADMIN: 2 };

// Loads the logged-in user on every request, so role changes and deactivation
// take effect immediately (the session cookie only holds the user id).
export async function requireAuth(req, res, next) {
  const userId = readSession(req);
  if (!userId) {
    throw new AppError(401, 'NOT_LOGGED_IN', 'Please log in.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) {
    // Deactivated or removed user: end the session in the browser too.
    endSession(res);
    throw new AppError(401, 'NOT_LOGGED_IN', 'Please log in.');
  }

  req.user = user;
  next();
}

// Use after requireAuth, e.g. router.get('/', requireAuth, requireRole('MODERATOR'), handler).
export function requireRole(minimumRole) {
  if (!(minimumRole in ROLE_RANK)) {
    throw new Error(`Unknown role: ${minimumRole}`);
  }

  return function checkRole(req, res, next) {
    if (!req.user) {
      throw new AppError(401, 'NOT_LOGGED_IN', 'Please log in.');
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minimumRole]) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this.');
    }
    next();
  };
}
