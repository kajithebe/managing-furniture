// AuditLog (02 › Data model): who changed settings, lists, locations, users and roles.
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
