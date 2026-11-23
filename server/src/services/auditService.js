// AuditLog (02 › Data model): who changed settings, lists, locations, users and roles.
import { prisma } from '../db.js';

// Call it with the transaction client (tx), so a change and its log entry are saved together.
export async function logChange(tx, { actorId, entity, entityId, action, before, after }) {
  await tx.auditLog.create({
    data: {
      actorId,
      entity,
      entityId,
      action,
      // Json columns: leave a value out instead of writing null.
      ...(before !== undefined && { before }),
      ...(after !== undefined && { after }),
    },
  });
}

export const AUDIT_PAGE_SIZE = 25;

// GET /api/admin/audit (A2 "View history"): newest first, 25 per page, optionally only one
// entity ("User") or one entry (entity + entityId). → { data, total }
export async function listAudit({ entity, entityId, page }) {
  const where = {
    ...(entity && { entity }),
    ...(entityId && { entityId }),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // AuditLog has no relation to User (only actorId), so the names are read in one extra query.
  const actorIds = [...new Set(rows.map((row) => row.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));

  return {
    data: rows.map(({ actorId, ...row }) => ({
      id: row.id,
      createdAt: row.createdAt,
      entity: row.entity,
      entityId: row.entityId,
      action: row.action,
      actor: actorById.get(actorId) ?? { id: actorId, name: null },
      before: row.before ?? null,
      after: row.after ?? null,
    })),
    total,
  };
}
