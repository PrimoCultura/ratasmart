import type { DurationTerm } from "../../shared/financial-engine/duration-terms.ts";
import { envelopeFromDurationTerms } from "../../shared/financial-engine/duration-terms.ts";
import type { NetworkCode } from "../../shared/domain/networks.ts";
import {
  DES_ALLOWED_TABLE_CODES,
  PAOLESCHI_ALLOWED_TABLE_CODES,
} from "../../shared/network-config/des-paoleschi-2026.ts";

export { DES_ALLOWED_TABLE_CODES, PAOLESCHI_ALLOWED_TABLE_CODES };

export type FinancialTableSeed2026 = {
  tableCode: string;
  productCode: string;
  productName: string;
  displayName: string;
  description: string;
  category:
    | "standard"
    | "zero_interest"
    | "subsidized"
    | "small_amount"
    | "special"
    | "bnpl";
  companyShortName: "Compass" | "HeyLight" | "Deutsche Bank";
  networks: NetworkCode[];
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: "none" | "fixed" | "percentage_of_requested_amount";
  installmentFeeValue?: number;
  internalCostBase?: "requested_amount" | "financed_amount";
  activeCommissionPercent?: number;
  activeCommissionBase?: "requested_amount";
  firstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
  adminNotes?: string;
  durationTerms?: DurationTerm[];
  minimumAmount?: number;
  maximumAmount?: number;
  minimumDurationMonths?: number;
  maximumDurationMonths?: number;
  durationStepMonths?: number;
};

export const HEYLIGHT_TR7_DEALER_COST_BY_DURATION: Record<number, number> = {
  1: 4.628,
  2: 5.0,
  3: 5.362,
  4: 5.724,
  5: 6.076,
  6: 6.438,
  7: 6.678,
  8: 7.04,
  9: 7.392,
  10: 7.754,
  11: 8.106,
  12: 8.458,
};

function heylightDurationTerms(): DurationTerm[] {
  return Object.entries(HEYLIGHT_TR7_DEALER_COST_BY_DURATION).map(
    ([months, cost]) => ({
      durationMonths: Number(months),
      minimumAmount: 300,
      maximumAmount: 3000,
      internalCostPercent: cost,
    }),
  );
}

/** Compass 4CF DES — struttura da 81K PCG, condizioni DES confermate. */
export const COMPASS_4CF_DES: FinancialTableSeed2026 = {
  tableCode: "4CF",
  productCode: "4CF",
  productName: "4CF – Standard",
  displayName: "4CF – Standard",
  description: "Compass DES 2026 – tabella 4CF (struttura allineata a 81K PCG).",
  category: "standard",
  companyShortName: "Compass",
  networks: ["DES"],
  minimumAmount: 1000,
  maximumAmount: 30000,
  minimumDurationMonths: 12,
  maximumDurationMonths: 84,
  durationStepMonths: 1,
  customerTanPercent: 10.75,
  openingFeeType: "none",
  openingFeeValue: 0,
  collectionFeePerInstallment: 3,
  installmentFeeType: "fixed",
  installmentFeeValue: 3,
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: false,
  adminNotes:
    "Importi/durate allineati a Compass 81K PCG; TAN 10,75%; opening 0; collection €3; company cost 0.",
};

/** HeyLight TR7 BNPL — PCG + DES */
export const HEYLIGHT_TR7: FinancialTableSeed2026 = {
  tableCode: "TR7",
  productCode: "TR7",
  productName: "HeyLight SmartPOS TR7",
  displayName: "HeyLight TR7",
  description:
    "HeyLight / SmartPOS BNPL TR7. Costi dealer per durata già comprensivi dell’IVA sulle componenti imponibili.",
  category: "bnpl",
  companyShortName: "HeyLight",
  networks: ["PCG", "DES"],
  customerTanPercent: 0,
  openingFeeType: "none",
  openingFeeValue: 0,
  collectionFeePerInstallment: 0,
  installmentFeeType: "none",
  installmentFeeValue: 0,
  internalCostBase: "requested_amount",
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: false,
  adminNotes:
    "BNPL: TAN paziente 0, spese paziente 0. Costo azienda = % dealer per n. rate su valore scontrino. Non usare come reference tasso zero.",
  durationTerms: heylightDurationTerms(),
};

/** Deutsche Bank ST — DES + Paoleschi */
export const DB_ST: FinancialTableSeed2026 = {
  tableCode: "DB_ST",
  productCode: "DB_ST",
  productName: "DB ST",
  displayName: "DB ST",
  description: "Deutsche Bank standard TAN 9,95% con provvigione attiva 2%.",
  category: "standard",
  companyShortName: "Deutsche Bank",
  networks: ["DES", "Paoleschi"],
  minimumAmount: 500,
  maximumAmount: 20000,
  minimumDurationMonths: 12,
  maximumDurationMonths: 72,
  durationStepMonths: 1,
  customerTanPercent: 9.95,
  openingFeeType: "none",
  openingFeeValue: 0,
  collectionFeePerInstallment: 3,
  installmentFeeType: "fixed",
  installmentFeeValue: 3,
  activeCommissionPercent: 2,
  activeCommissionBase: "requested_amount",
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: false,
  adminNotes:
    "Provvigione attiva 2% su requested amount: aumenta companyEconomicValue, non modifica totale paziente.",
};

/** Deutsche Bank tasso ridotto 4,49% */
export const DB_449: FinancialTableSeed2026 = {
  tableCode: "DB_449",
  productCode: "DB_449",
  productName: "DB Tasso Ridotto",
  displayName: "DB Tasso Ridotto",
  description: "Deutsche Bank tasso ridotto 4,49% con company cost 4%.",
  category: "subsidized",
  companyShortName: "Deutsche Bank",
  networks: ["DES", "Paoleschi"],
  customerTanPercent: 4.49,
  openingFeeType: "none",
  openingFeeValue: 0,
  collectionFeePerInstallment: 3,
  installmentFeeType: "fixed",
  installmentFeeValue: 3,
  internalCostBase: "requested_amount",
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: true,
  durationTerms: [12, 18, 24, 36, 48].map((durationMonths) => ({
    durationMonths,
    minimumAmount: 500,
    maximumAmount: 10000,
    internalCostPercent: 4,
  })),
};

/** Deutsche Bank zero */
export const DB_ZERO: FinancialTableSeed2026 = {
  tableCode: "DB_ZERO",
  productCode: "DB_ZERO",
  productName: "DB Zero",
  displayName: "DB Zero",
  description:
    "Deutsche Bank tasso zero. Company cost 0,375%/mese (4,50% @12 / 6,75% @18 / 9% @24).",
  category: "zero_interest",
  companyShortName: "Deutsche Bank",
  networks: ["DES", "Paoleschi"],
  customerTanPercent: 0,
  openingFeeType: "none",
  openingFeeValue: 0,
  collectionFeePerInstallment: 3,
  installmentFeeType: "fixed",
  installmentFeeValue: 3,
  internalCostBase: "requested_amount",
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: true,
  durationTerms: [
    {
      durationMonths: 12,
      minimumAmount: 300,
      maximumAmount: 10000,
      internalCostPercent: 4.5,
    },
    {
      durationMonths: 18,
      minimumAmount: 300,
      maximumAmount: 10000,
      internalCostPercent: 6.75,
    },
    {
      durationMonths: 24,
      minimumAmount: 300,
      maximumAmount: 10000,
      internalCostPercent: 9,
    },
  ],
};

/** Deutsche Bank Senior SMV — PCG + DES + Paoleschi */
export const DB_SMV: FinancialTableSeed2026 = {
  tableCode: "SMV",
  productCode: "SMV",
  productName: "SMV – Senior",
  displayName: "SMV – Senior",
  description: "Deutsche Bank Senior SMV – tasso standard 12,00%.",
  category: "standard",
  companyShortName: "Deutsche Bank",
  networks: ["PCG", "DES", "Paoleschi"],
  customerTanPercent: 12,
  openingFeeType: "percentage",
  openingFeeValue: 2.5,
  collectionFeePerInstallment: 3,
  installmentFeeType: "fixed",
  installmentFeeValue: 3,
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: false,
  adminNotes:
    "Solo durate 30/36. Età Senior: 77a6m1g – 85a11m29g (policy precisa su tabella).",
  durationTerms: [
    {
      durationMonths: 30,
      minimumAmount: 3000,
      maximumAmount: 4870,
    },
    {
      durationMonths: 36,
      minimumAmount: 3000,
      maximumAmount: 4870,
    },
  ],
};

export const DES_PAOLESCHI_TABLE_SEEDS: FinancialTableSeed2026[] = [
  COMPASS_4CF_DES,
  HEYLIGHT_TR7,
  DB_ST,
  DB_449,
  DB_ZERO,
  DB_SMV,
];

export const PCG_ADDON_TABLE_SEEDS: FinancialTableSeed2026[] = [
  {
    ...HEYLIGHT_TR7,
    networks: ["PCG"],
  },
  {
    ...DB_SMV,
    networks: ["PCG"],
  },
];

export function buildEconomicsFromSeed2026(seed: FinancialTableSeed2026) {
  if (seed.durationTerms && seed.durationTerms.length > 0) {
    const envelope = envelopeFromDurationTerms(seed.durationTerms);
    return {
      minimumAmount: envelope.minimumAmount,
      maximumAmount: envelope.maximumAmount,
      minimumDurationMonths: envelope.minimumDurationMonths,
      maximumDurationMonths: envelope.maximumDurationMonths,
      durationStepMonths: 1,
      customerTanPercent: seed.customerTanPercent,
      openingFeeType: seed.openingFeeType,
      openingFeeValue: seed.openingFeeValue,
      collectionFeePerInstallment:
        seed.installmentFeeType === "percentage_of_requested_amount"
          ? 0
          : seed.installmentFeeType === "fixed"
            ? (seed.installmentFeeValue ?? seed.collectionFeePerInstallment)
            : seed.collectionFeePerInstallment,
      installmentFeeType: seed.installmentFeeType,
      installmentFeeValue: seed.installmentFeeValue,
      internalCostBase: seed.internalCostBase,
      activeCommissionPercent: seed.activeCommissionPercent,
      activeCommissionBase: seed.activeCommissionBase,
      durationTerms: seed.durationTerms,
      firstInstallmentDelayDays: seed.firstInstallmentDelayDays,
      requiresManagerAuthorizationNotice:
        seed.requiresManagerAuthorizationNotice,
    };
  }

  return {
    minimumAmount: seed.minimumAmount!,
    maximumAmount: seed.maximumAmount!,
    minimumDurationMonths: seed.minimumDurationMonths!,
    maximumDurationMonths: seed.maximumDurationMonths!,
    durationStepMonths: seed.durationStepMonths ?? 1,
    customerTanPercent: seed.customerTanPercent,
    openingFeeType: seed.openingFeeType,
    openingFeeValue: seed.openingFeeValue,
    collectionFeePerInstallment: seed.collectionFeePerInstallment,
    installmentFeeType: seed.installmentFeeType,
    installmentFeeValue: seed.installmentFeeValue,
    internalCostBase: seed.internalCostBase,
    activeCommissionPercent: seed.activeCommissionPercent,
    activeCommissionBase: seed.activeCommissionBase,
    durationTerms: undefined,
    firstInstallmentDelayDays: seed.firstInstallmentDelayDays,
    requiresManagerAuthorizationNotice: seed.requiresManagerAuthorizationNotice,
  };
}

function sortTerms(terms: DurationTerm[]) {
  return [...terms]
    .map((term) => ({
      durationMonths: term.durationMonths,
      minimumAmount: term.minimumAmount,
      maximumAmount: term.maximumAmount,
      customerTanPercent: term.customerTanPercent,
      internalCostPercent: term.internalCostPercent,
    }))
    .sort((a, b) => a.durationMonths - b.durationMonths);
}

export function tableEconomicsMatchSeed2026(
  existing: {
    displayName: string;
    category: string;
    minimumAmount: number;
    maximumAmount: number;
    minimumDurationMonths: number;
    maximumDurationMonths: number;
    durationStepMonths: number;
    customerTanPercent: number;
    openingFeeType: string;
    openingFeeValue: number;
    collectionFeePerInstallment: number;
    installmentFeeType?: string;
    installmentFeeValue?: number;
    internalCostPercentAt24Months?: number;
    internalCostBase?: string;
    activeCommissionPercent?: number;
    activeCommissionBase?: string;
    durationTerms?: DurationTerm[];
    firstInstallmentDelayDays: number[];
    requiresManagerAuthorizationNotice: boolean;
    adminNotes?: string;
  },
  seed: FinancialTableSeed2026,
): boolean {
  const expected = buildEconomicsFromSeed2026(seed);
  if (existing.displayName !== seed.displayName) return false;
  if (existing.category !== seed.category) return false;
  if (existing.minimumAmount !== expected.minimumAmount) return false;
  if (existing.maximumAmount !== expected.maximumAmount) return false;
  if (existing.minimumDurationMonths !== expected.minimumDurationMonths) {
    return false;
  }
  if (existing.maximumDurationMonths !== expected.maximumDurationMonths) {
    return false;
  }
  if (existing.durationStepMonths !== expected.durationStepMonths) return false;
  if (existing.customerTanPercent !== expected.customerTanPercent) return false;
  if (existing.openingFeeType !== expected.openingFeeType) return false;
  if (existing.openingFeeValue !== expected.openingFeeValue) return false;
  if (
    existing.collectionFeePerInstallment !==
    expected.collectionFeePerInstallment
  ) {
    return false;
  }
  if (
    (existing.installmentFeeType ?? undefined) !==
    (expected.installmentFeeType ?? undefined)
  ) {
    return false;
  }
  if (
    (existing.installmentFeeValue ?? undefined) !==
    (expected.installmentFeeValue ?? undefined)
  ) {
    return false;
  }
  if (
    (existing.internalCostBase ?? undefined) !==
    (expected.internalCostBase ?? undefined)
  ) {
    return false;
  }
  if (
    (existing.activeCommissionPercent ?? undefined) !==
    (expected.activeCommissionPercent ?? undefined)
  ) {
    return false;
  }
  if (
    (existing.activeCommissionBase ?? undefined) !==
    (expected.activeCommissionBase ?? undefined)
  ) {
    return false;
  }
  if (existing.internalCostPercentAt24Months !== undefined) return false;
  if (
    existing.requiresManagerAuthorizationNotice !==
    expected.requiresManagerAuthorizationNotice
  ) {
    return false;
  }
  const existingDelays = [...existing.firstInstallmentDelayDays].sort(
    (a, b) => a - b,
  );
  const expectedDelays = [...expected.firstInstallmentDelayDays].sort(
    (a, b) => a - b,
  );
  if (JSON.stringify(existingDelays) !== JSON.stringify(expectedDelays)) {
    return false;
  }
  if (
    JSON.stringify(sortTerms(existing.durationTerms ?? [])) !==
    JSON.stringify(sortTerms(expected.durationTerms ?? []))
  ) {
    return false;
  }
  if ((existing.adminNotes ?? undefined) !== (seed.adminNotes ?? undefined)) {
    return false;
  }
  return true;
}
