import type { Doc, Id } from "../../convex/_generated/dataModel";

export type AppUser = Doc<"appUsers">;
export type Simulation = Doc<"simulations">;
export type FinancialCompany = Doc<"financialCompanies">;
export type FinancialProduct = Doc<"financialProducts">;
export type FinancialTable = Doc<"financialTables">;
export type PolicySet = Doc<"policySets">;
export type PolicyRule = Doc<"policyRules">;
export type CommercialPriority = Doc<"commercialPriorities">;
export type InternalMessage = Doc<"internalMessages">;

export type AppUserId = Id<"appUsers">;
export type SimulationId = Id<"simulations">;
export type FinancialCompanyId = Id<"financialCompanies">;
export type FinancialProductId = Id<"financialProducts">;
export type FinancialTableId = Id<"financialTables">;

/**
 * FASE 3: le simulazioni dovranno conservare uno snapshot delle condizioni
 * utilizzate (tableId, version, TAN, fee, durate, costi) per audit storico.
 */
export type FinancialConditionsSnapshot = {
  financialTableId: FinancialTableId;
  tableCode: string;
  version: number;
  network: "PCG" | "DES";
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  internalCostPercentAt24Months?: number;
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  firstInstallmentDelayDays: number[];
  capturedAt: number;
};
