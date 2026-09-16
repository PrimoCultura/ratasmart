import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type AdminAuditAction =
  | "user_disabled"
  | "user_enabled"
  | "user_anonymized"
  | "simulation_deleted"
  | "simulation_restored";

export async function insertAdminAuditLog(
  ctx: MutationCtx,
  input: {
    adminUserId: Id<"appUsers">;
    action: AdminAuditAction;
    entityType: "appUsers" | "simulations";
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.db.insert("adminAuditLogs", {
    adminUserId: input.adminUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    timestamp: Date.now(),
    metadata: input.metadata,
  });
}
