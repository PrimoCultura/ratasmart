import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type DbCtx = QueryCtx | MutationCtx;

/**
 * SECURITY NOTE (fase Auth0):
 * Oggi l'identità demo è accettata dal client (ownerUserId / actorUserId).
 * In produzione l'identità dovrà essere ricavata lato server da Auth0
 * e NON accettata liberamente dal client.
 */
export async function requireActiveUser(ctx: DbCtx, userId: Id<"appUsers">) {
  const user = await ctx.db.get(userId);
  if (!user || !user.isActive) {
    throw new Error("Utente non trovato o non attivo.");
  }
  return user;
}

/**
 * TODO Auth0:
 * in produzione l'identità dovrà essere ottenuta da ctx.auth,
 * non ricevuta liberamente dal client.
 */
export async function requireAdmin(
  ctx: DbCtx,
  actorUserId: Id<"appUsers">,
): Promise<Doc<"appUsers">> {
  const user = await requireActiveUser(ctx, actorUserId);
  if (user.role !== "admin") {
    throw new Error("Solo gli amministratori possono eseguire questa operazione.");
  }
  return user;
}

export function isCurrentlyValid(
  now: number,
  validFrom?: number,
  validTo?: number,
): boolean {
  if (validFrom !== undefined && now < validFrom) {
    return false;
  }
  if (validTo !== undefined && now > validTo) {
    return false;
  }
  return true;
}
