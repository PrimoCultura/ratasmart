import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireActiveUser } from "./lib/authHelpers";
import { insertAdminAuditLog } from "./lib/adminAudit";
import { isSimulationSoftDeleted } from "../shared/admin-analytics";

const deletionReasonValidator = v.union(
  v.literal("data_entry_error"),
  v.literal("test"),
  v.literal("duplicate"),
  v.literal("user_request"),
  v.literal("other"),
);

/**
 * Governance utenti + soft-delete simulazioni + audit.
 * Identity provider (Auth0) non è ancora integrato: si gestisce solo il profilo applicativo.
 */

export const listAdminUsers = query({
  args: {
    actorUserId: v.id("appUsers"),
    network: v.optional(v.string()),
    clinicName: v.optional(v.string()),
    role: v.optional(v.union(v.literal("cm"), v.literal("admin"))),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    let users = await ctx.db.query("appUsers").collect();

    if (args.role) {
      users = users.filter((user) => user.role === args.role);
    }
    if (args.status === "active") {
      users = users.filter((user) => user.isActive);
    } else if (args.status === "inactive") {
      users = users.filter((user) => !user.isActive);
    }
    if (args.clinicName && args.clinicName !== "ALL") {
      const clinic = args.clinicName.trim().toLowerCase();
      users = users.filter(
        (user) => (user.clinicName ?? "").toLowerCase() === clinic,
      );
    }
    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      users = users.filter((user) => {
        const hay = [
          user.firstName,
          user.lastName,
          user.displayName,
          user.clinicName ?? "",
          user.externalAuthId ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // Network non è sul profilo utente (solo sulle simulazioni) → filtro ignorato lato users.
    void args.network;

    const simulations = await ctx.db.query("simulations").collect();
    const simCountByOwner = new Map<string, number>();
    for (const simulation of simulations) {
      if (isSimulationSoftDeleted(simulation)) continue;
      const key = simulation.ownerUserId;
      simCountByOwner.set(key, (simCountByOwner.get(key) ?? 0) + 1);
    }

    return users
      .map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        clinicName: user.clinicName,
        role: user.role,
        isActive: user.isActive,
        isDemo: user.isDemo,
        externalAuthId: user.externalAuthId,
        anonymizedAt: user.anonymizedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        simulationsCount: simCountByOwner.get(user._id) ?? 0,
        /** Non disponibile in auth demo pre-Auth0. */
        lastAccessAt: null as number | null,
        /** Non disponibile: nessun campo email sul profilo applicativo. */
        email: null as string | null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const setUserActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    userId: v.id("appUsers"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.actorUserId);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Utente non trovato.");
    if (user._id === admin._id && !args.isActive) {
      throw new Error("Non puoi disattivare il tuo stesso account admin.");
    }
    if (user.anonymizedAt) {
      throw new Error("Utente anonymizzato: non può essere riattivato.");
    }

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      isActive: args.isActive,
      updatedAt: now,
    });
    await insertAdminAuditLog(ctx, {
      adminUserId: admin._id,
      action: args.isActive ? "user_enabled" : "user_disabled",
      entityType: "appUsers",
      entityId: args.userId,
      metadata: { role: user.role },
    });
    return args.userId;
  },
});

/**
 * Anonymizza il profilo applicativo. Non elimina Auth0 (non integrato).
 * Le simulazioni storiche restano con ownerUserId.
 */
export const anonymizeUser = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    userId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.actorUserId);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Utente non trovato.");
    if (user._id === admin._id) {
      throw new Error("Non puoi eliminare il tuo stesso account admin.");
    }
    if (user.anonymizedAt) {
      return args.userId;
    }

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      firstName: "Utente",
      lastName: "eliminato",
      displayName: "Utente eliminato",
      clinicName: undefined,
      externalAuthId: undefined,
      isActive: false,
      anonymizedAt: now,
      updatedAt: now,
    });
    await insertAdminAuditLog(ctx, {
      adminUserId: admin._id,
      action: "user_anonymized",
      entityType: "appUsers",
      entityId: args.userId,
      metadata: {
        note: "Profilo applicativo anonymizzato; nessun account IdP da eliminare (pre-Auth0).",
        previousRole: user.role,
      },
    });
    return args.userId;
  },
});

export const softDeleteSimulation = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
    deletionReason: deletionReasonValidator,
    deletionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.actorUserId);
    const simulation = await ctx.db.get(args.simulationId);
    if (!simulation) throw new Error("Simulazione non trovata.");
    if (
      actor.role !== "admin" &&
      simulation.ownerUserId !== args.actorUserId
    ) {
      throw new Error("Non sei autorizzato a eliminare questa simulazione.");
    }
    if (isSimulationSoftDeleted(simulation)) {
      return args.simulationId;
    }

    const now = Date.now();
    await ctx.db.patch(args.simulationId, {
      deletedAt: now,
      deletedBy: args.actorUserId,
      deletionReason: args.deletionReason,
      deletionNotes: args.deletionNotes?.trim() || undefined,
      updatedAt: now,
    });

    if (actor.role === "admin") {
      await insertAdminAuditLog(ctx, {
        adminUserId: actor._id,
        action: "simulation_deleted",
        entityType: "simulations",
        entityId: args.simulationId,
        metadata: {
          deletionReason: args.deletionReason,
          network: simulation.network,
        },
      });
    }
    return args.simulationId;
  },
});

export const restoreSimulation = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.actorUserId);
    const simulation = await ctx.db.get(args.simulationId);
    if (!simulation) throw new Error("Simulazione non trovata.");
    if (!isSimulationSoftDeleted(simulation)) {
      return args.simulationId;
    }

    const now = Date.now();
    await ctx.db.patch(args.simulationId, {
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
      deletionNotes: undefined,
      updatedAt: now,
    });
    await insertAdminAuditLog(ctx, {
      adminUserId: admin._id,
      action: "simulation_restored",
      entityType: "simulations",
      entityId: args.simulationId,
      metadata: { network: simulation.network },
    });
    return args.simulationId;
  },
});

export const listAdminAuditLogs = query({
  args: {
    actorUserId: v.id("appUsers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const logs = await ctx.db
      .query("adminAuditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
    return logs;
  },
});
