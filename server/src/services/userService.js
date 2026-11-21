// User changes. A user's own data is found by the id from the session, never from the request.
import { prisma } from '../db.js';
import { publicUser } from './authService.js';

export async function updateOwnName(userId, name) {
  const user = await prisma.user.update({ where: { id: userId }, data: { name } });
  return publicUser(user);
}
