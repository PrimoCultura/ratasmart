import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_DEMO_CM_USERS = 2;

/**
 * SECURITY NOTE (fase Auth0):
 * Oggi l'identità demo è accettata dal client (ownerUserId / userId).
 * In produzione l'identità dovrà essere ricavata lato server da Auth0
 * (identity.tokenIdentifier / externalAuthId) e NON accettata liberamente dal client.
 */

export const listDemoCmUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("appUsers")
      .withIndex("by_role", (q) => q.eq("role", "cm"))
      .collect();

    return users
      .filter((user) => user.isDemo && user.isActive)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const getUserById = query({
  args: { userId: v.id("appUsers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const createDemoCmUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    clinicName: v.string(),
  },
  handler: async (ctx, args) => {
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    const clinicName = args.clinicName.trim();

    if (!firstName || !lastName || !clinicName) {
      throw new Error("Nome, cognome e clinica sono obbligatori.");
    }

    const existing = await ctx.db
      .query("appUsers")
      .withIndex("by_role", (q) => q.eq("role", "cm"))
      .collect();

    const activeDemoCm = existing.filter((user) => user.isDemo && user.isActive);

    if (activeDemoCm.length >= MAX_DEMO_CM_USERS) {
      throw new Error(
        "Sono già presenti 2 profili CM demo. Seleziona un profilo esistente oppure cambia profilo.",
      );
    }

    const now = Date.now();
    const displayName = `${firstName} ${lastName}`;

    return await ctx.db.insert("appUsers", {
      firstName,
      lastName,
      displayName,
      clinicName,
      role: "cm",
      isDemo: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const ensureDemoAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("appUsers")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    const existingDemoAdmin = admins.find((user) => user.isDemo && user.isActive);
    if (existingDemoAdmin) {
      return existingDemoAdmin._id;
    }

    const now = Date.now();
    return await ctx.db.insert("appUsers", {
      firstName: "Admin",
      lastName: "Demo",
      displayName: "Admin Demo",
      role: "admin",
      isDemo: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const countDemoCmUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("appUsers")
      .withIndex("by_role", (q) => q.eq("role", "cm"))
      .collect();

    return users.filter((user) => user.isDemo && user.isActive).length;
  },
});
