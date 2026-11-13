// One shared Prisma Client for the whole server.
// Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './config/env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
