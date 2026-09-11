import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveUser } from "./lib/authHelpers";

/**
 * SECURITY NOTE (fase Auth0):
 * Le query/mutation accettano ancora `ownerUserId` / `actorUserId` dal client.
 * Con Auth0 l'identità dovrà essere ricavata lato server e confrontata con
 * i documenti, senza fidarsi dell'ID inviato dal client.
 */

const employmentTypeValidator = v.union(
  v.literal("permanent_employee"),
  v.literal("temporary_employee"),
  v.literal("pensioner"),
  v.literal("self_employed"),
  v.literal("unemployed"),
  v.literal("student"),
  v.literal("housewife"),
  v.literal("other"),
);

const networkValidator = v.union(v.literal("PCG"), v.literal("DES"));

const delayDaysValidator = v.union(
  v.literal(30),
  v.literal(60),
  v.literal(90),
);

function validatePatientFields(args: {
  patientFirstName: string;
  patientLastName: string;
  requestedAmount: number;
  targetInstallment?: number;
  patientAge: number;
  employmentType:
    | "permanent_employee"
    | "temporary_employee"
    | "pensioner"
    | "self_employed"
    | "unemployed"
    | "student"
    | "housewife"
    | "other";
  temporaryContractExpiry?: number;
  isNonEuCitizen: boolean;
  residencePermitExpiry?: number;
  requestedDurationMonths?: number;
  preferredFirstInstallmentDelayDays?: number;
}) {
  const patientFirstName = args.patientFirstName.trim();
  const patientLastName = args.patientLastName.trim();

  if (!patientFirstName || !patientLastName) {
    throw new Error("Nome e cognome del paziente sono obbligatori.");
  }

  if (!Number.isInteger(args.patientAge) || args.patientAge < 18) {
    throw new Error("L'età deve essere un intero maggiore o uguale a 18.");
  }

  if (args.requestedAmount <= 0) {
    throw new Error("L'importo richiesto deve essere maggiore di zero.");
  }

  if (args.targetInstallment !== undefined && args.targetInstallment <= 0) {
    throw new Error(
      "La rata obiettivo, se indicata, deve essere maggiore di zero.",
    );
  }

  if (
    args.requestedDurationMonths !== undefined &&
    (!Number.isInteger(args.requestedDurationMonths) ||
      args.requestedDurationMonths <= 0)
  ) {
    throw new Error("La durata desiderata deve essere un intero maggiore di zero.");
  }

  if (
    args.preferredFirstInstallmentDelayDays !== undefined &&
    ![30, 60, 90].includes(args.preferredFirstInstallmentDelayDays)
  ) {
    throw new Error("La prima rata preferita deve essere 30, 60 o 90 giorni.");
  }

  const now = Date.now();

  if (args.employmentType === "temporary_employee") {
    if (args.temporaryContractExpiry === undefined) {
      throw new Error("La scadenza del contratto determinato è obbligatoria.");
    }
    if (args.temporaryContractExpiry <= now) {
      throw new Error("La scadenza del contratto deve essere futura.");
    }
  }

  if (args.isNonEuCitizen) {
    if (args.residencePermitExpiry === undefined) {
      throw new Error("La scadenza del permesso di soggiorno è obbligatoria.");
    }
    if (args.residencePermitExpiry <= now) {
      throw new Error("La scadenza del permesso di soggiorno deve essere futura.");
    }
  }

  return { patientFirstName, patientLastName };
}

export const listMySimulations = query({
  args: {
    ownerUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("simulations")
      .withIndex("by_owner_updated_at", (q) =>
        q.eq("ownerUserId", args.ownerUserId),
      )
      .order("desc")
      .collect();
  },
});

export const listAllSimulations = query({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.actorUserId);
    if (actor.role !== "admin") {
      throw new Error(
        "Solo gli amministratori possono visualizzare tutte le simulazioni.",
      );
    }

    const simulations = await ctx.db.query("simulations").collect();
    return simulations.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const countAllSimulations = query({
  args: {},
  handler: async (ctx) => {
    const simulations = await ctx.db.query("simulations").collect();
    return simulations.length;
  },
});

export const getSimulation = query({
  args: {
    simulationId: v.id("simulations"),
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.actorUserId);
    const simulation = await ctx.db.get(args.simulationId);

    if (!simulation) {
      return null;
    }

    if (actor.role !== "admin" && simulation.ownerUserId !== args.actorUserId) {
      throw new Error(
        "Non sei autorizzato a visualizzare questa simulazione.",
      );
    }

    return simulation;
  },
});

export const createDraftSimulation = mutation({
  args: {
    ownerUserId: v.id("appUsers"),
    patientFirstName: v.string(),
    patientLastName: v.string(),
    network: networkValidator,
    requestedAmount: v.number(),
    targetInstallment: v.optional(v.number()),
    patientAge: v.optional(v.number()),
    employmentType: v.optional(employmentTypeValidator),
    temporaryContractExpiry: v.optional(v.number()),
    isNonEuCitizen: v.optional(v.boolean()),
    residencePermitExpiry: v.optional(v.number()),
    hasResidencePermitRenewalReceiptOnly: v.optional(v.boolean()),
    employmentStartDate: v.optional(v.string()),
    employmentSeniorityMonths: v.optional(v.number()),
    hasGuarantor: v.optional(v.boolean()),
    patientRequestsZeroInterest: v.optional(v.boolean()),
    requestedDurationMonths: v.optional(v.number()),
    preferredFirstInstallmentDelayDays: v.optional(delayDaysValidator),
  },
  handler: async (ctx, args) => {
    const owner = await requireActiveUser(ctx, args.ownerUserId);
    if (owner.role !== "cm") {
      throw new Error("Solo i Clinic Manager possono creare simulazioni.");
    }

    const patientFirstName = args.patientFirstName.trim();
    const patientLastName = args.patientLastName.trim();

    if (!patientFirstName || !patientLastName) {
      throw new Error("Nome e cognome del paziente sono obbligatori.");
    }

    if (args.requestedAmount <= 0) {
      throw new Error("L'importo richiesto deve essere maggiore di zero.");
    }

    if (args.targetInstallment !== undefined && args.targetInstallment <= 0) {
      throw new Error(
        "La rata obiettivo, se indicata, deve essere maggiore di zero.",
      );
    }

    const now = Date.now();

    return await ctx.db.insert("simulations", {
      ownerUserId: args.ownerUserId,
      patientFirstName,
      patientLastName,
      network: args.network,
      status: "draft",
      comparisonStatus: "not_started",
      requestedAmount: args.requestedAmount,
      targetInstallment: args.targetInstallment,
      patientAge: args.patientAge,
      employmentType: args.employmentType,
      temporaryContractExpiry: args.temporaryContractExpiry,
      isNonEuCitizen: args.isNonEuCitizen,
      residencePermitExpiry: args.residencePermitExpiry,
      hasResidencePermitRenewalReceiptOnly:
        args.hasResidencePermitRenewalReceiptOnly,
      employmentStartDate: args.employmentStartDate,
      employmentSeniorityMonths: args.employmentSeniorityMonths,
      hasGuarantor: args.hasGuarantor,
      patientRequestsZeroInterest: args.patientRequestsZeroInterest === true,
      requestedDurationMonths: args.requestedDurationMonths,
      preferredFirstInstallmentDelayDays:
        args.preferredFirstInstallmentDelayDays,
      lastInputUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSimulationPatientData = mutation({
  args: {
    simulationId: v.optional(v.id("simulations")),
    actorUserId: v.id("appUsers"),
    patientFirstName: v.string(),
    patientLastName: v.string(),
    network: networkValidator,
    requestedAmount: v.number(),
    targetInstallment: v.optional(v.number()),
    patientAge: v.number(),
    employmentType: employmentTypeValidator,
    temporaryContractExpiry: v.optional(v.number()),
    isNonEuCitizen: v.boolean(),
    residencePermitExpiry: v.optional(v.number()),
    hasResidencePermitRenewalReceiptOnly: v.optional(v.boolean()),
    employmentStartDate: v.optional(v.string()),
    employmentSeniorityMonths: v.optional(v.number()),
    hasGuarantor: v.optional(v.boolean()),
    patientRequestsZeroInterest: v.optional(v.boolean()),
    requestedDurationMonths: v.optional(v.number()),
    preferredFirstInstallmentDelayDays: v.optional(delayDaysValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.actorUserId);
    if (actor.role !== "cm" && actor.role !== "admin") {
      throw new Error("Non autorizzato.");
    }

    const { patientFirstName, patientLastName } = validatePatientFields(args);
    const now = Date.now();

    const storesEmploymentStart =
      args.employmentType === "permanent_employee" ||
      args.employmentType === "temporary_employee";

    const payload = {
      patientFirstName,
      patientLastName,
      network: args.network,
      requestedAmount: args.requestedAmount,
      targetInstallment: args.targetInstallment,
      patientAge: args.patientAge,
      employmentType: args.employmentType,
      temporaryContractExpiry:
        args.employmentType === "temporary_employee"
          ? args.temporaryContractExpiry
          : undefined,
      isNonEuCitizen: args.isNonEuCitizen,
      residencePermitExpiry: args.isNonEuCitizen
        ? args.residencePermitExpiry
        : undefined,
      hasResidencePermitRenewalReceiptOnly: args.isNonEuCitizen
        ? args.hasResidencePermitRenewalReceiptOnly
        : undefined,
      employmentStartDate: storesEmploymentStart
        ? args.employmentStartDate
        : undefined,
      employmentSeniorityMonths: storesEmploymentStart
        ? args.employmentSeniorityMonths
        : undefined,
      hasGuarantor: args.hasGuarantor,
      patientRequestsZeroInterest: args.patientRequestsZeroInterest === true,
      requestedDurationMonths: args.requestedDurationMonths,
      preferredFirstInstallmentDelayDays:
        args.preferredFirstInstallmentDelayDays,
      lastInputUpdatedAt: now,
      updatedAt: now,
    };

    if (args.simulationId) {
      const simulation = await ctx.db.get(args.simulationId);
      if (!simulation) {
        throw new Error("Simulazione non trovata.");
      }
      if (
        actor.role !== "admin" &&
        simulation.ownerUserId !== args.actorUserId
      ) {
        throw new Error(
          "Non sei autorizzato a modificare questa simulazione.",
        );
      }
      await ctx.db.patch(args.simulationId, payload);
      return args.simulationId;
    }

    if (actor.role !== "cm") {
      throw new Error("Solo i Clinic Manager possono creare simulazioni.");
    }

    return await ctx.db.insert("simulations", {
      ownerUserId: args.actorUserId,
      status: "draft",
      comparisonStatus: "not_started",
      createdAt: now,
      ...payload,
    });
  },
});

export const updateSimulationBasicData = mutation({
  args: {
    simulationId: v.id("simulations"),
    actorUserId: v.id("appUsers"),
    patientFirstName: v.string(),
    patientLastName: v.string(),
    network: networkValidator,
    requestedAmount: v.number(),
    targetInstallment: v.optional(v.number()),
    status: v.optional(v.union(v.literal("draft"), v.literal("proposed"))),
    patientAge: v.optional(v.number()),
    employmentType: v.optional(employmentTypeValidator),
    temporaryContractExpiry: v.optional(v.number()),
    isNonEuCitizen: v.optional(v.boolean()),
    residencePermitExpiry: v.optional(v.number()),
    requestedDurationMonths: v.optional(v.number()),
    preferredFirstInstallmentDelayDays: v.optional(delayDaysValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.actorUserId);
    const simulation = await ctx.db.get(args.simulationId);

    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }

    if (actor.role !== "admin" && simulation.ownerUserId !== args.actorUserId) {
      throw new Error(
        "Non sei autorizzato a modificare questa simulazione.",
      );
    }

    if (args.requestedAmount <= 0) {
      throw new Error("L'importo richiesto deve essere maggiore di zero.");
    }

    if (args.targetInstallment !== undefined && args.targetInstallment <= 0) {
      throw new Error(
        "La rata obiettivo, se indicata, deve essere maggiore di zero.",
      );
    }

    const now = Date.now();
    await ctx.db.patch(args.simulationId, {
      patientFirstName: args.patientFirstName.trim(),
      patientLastName: args.patientLastName.trim(),
      network: args.network,
      requestedAmount: args.requestedAmount,
      targetInstallment: args.targetInstallment,
      status: args.status ?? simulation.status,
      patientAge: args.patientAge ?? simulation.patientAge,
      employmentType: args.employmentType ?? simulation.employmentType,
      temporaryContractExpiry:
        args.temporaryContractExpiry ?? simulation.temporaryContractExpiry,
      isNonEuCitizen: args.isNonEuCitizen ?? simulation.isNonEuCitizen,
      residencePermitExpiry:
        args.residencePermitExpiry ?? simulation.residencePermitExpiry,
      requestedDurationMonths:
        args.requestedDurationMonths ?? simulation.requestedDurationMonths,
      preferredFirstInstallmentDelayDays:
        args.preferredFirstInstallmentDelayDays ??
        simulation.preferredFirstInstallmentDelayDays,
      lastInputUpdatedAt: now,
      updatedAt: now,
    });

    return args.simulationId;
  },
});

export const deleteSimulation = mutation({
  args: {
    simulationId: v.id("simulations"),
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    const actor = await requireActiveUser(ctx, args.actorUserId);
    const simulation = await ctx.db.get(args.simulationId);

    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }

    if (actor.role !== "admin" && simulation.ownerUserId !== args.actorUserId) {
      throw new Error("Non sei autorizzato a eliminare questa simulazione.");
    }

    // Cascade: elimina soluzioni e run collegati (niente orfani).
    const solutions = await ctx.db
      .query("simulationComparisonSolutions")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .collect();
    for (const solution of solutions) {
      await ctx.db.delete(solution._id);
    }

    const runs = await ctx.db
      .query("simulationComparisonRuns")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .collect();
    for (const run of runs) {
      await ctx.db.delete(run._id);
    }

    await ctx.db.delete(args.simulationId);
    return true;
  },
});
