import type { DurationTerm } from "../../shared/financial-engine/duration-terms.ts";
import { envelopeFromDurationTerms } from "../../shared/financial-engine/duration-terms.ts";

export type AgosPcgProductSeed = {
  code: string;
  name: string;
  category:
    | "standard"
    | "zero_interest"
    | "subsidized"
    | "small_amount"
    | "special";
  description?: string;
};

export type AgosPcgTableSeed = {
  tableCode: string;
  productCode: string;
  displayName: string;
  description: string;
  category: AgosPcgProductSeed["category"];
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  firstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
  adminNotes?: string;
  durationTerms: DurationTerm[];
};

export const AGOS_PCG_PRODUCTS: AgosPcgProductSeed[] = [
  {
    code: "NBQ",
    name: "NBQ – Standard 30 giorni",
    category: "standard",
    description: "Finanziamento standard Agos PCG con prima rata a 30 giorni.",
  },
  {
    code: "NBS",
    name: "NBS – Standard 60 giorni",
    category: "standard",
    description: "Finanziamento standard Agos PCG con prima rata a 60 giorni.",
  },
  {
    code: "PR3",
    name: "PR3 – Piccoli importi",
    category: "small_amount",
    description: "Tabella Agos PCG per piccoli importi.",
  },
  {
    code: "PCA",
    name: "PCA – Tasso zero 30 giorni",
    category: "zero_interest",
    description: "Tasso zero Agos PCG con prima rata a 30 giorni.",
  },
  {
    code: "PCJ",
    name: "PCJ – Tasso zero 60 giorni",
    category: "zero_interest",
    description: "Tasso zero Agos PCG con prima rata a 60 giorni.",
  },
  {
    code: "PV2",
    name: "PV2 – Tasso agevolato",
    category: "subsidized",
    description: "Tasso agevolato Agos PCG.",
  },
  {
    code: "AGOS_PASS",
    name: "Agos Pass",
    category: "special",
    description:
      "Rappresentazione semplificata RataSmart del piano Agos Pass (durate 3–12 mesi).",
  },
];

export const AGOS_PCG_TABLES: AgosPcgTableSeed[] = [
  {
    tableCode: "NBQ",
    productCode: "NBQ",
    displayName: "NBQ – Standard 30 giorni",
    description: "Agos PCG 2026 – Standard, prima rata 30 giorni.",
    category: "standard",
    customerTanPercent: 10.5,
    openingFeeType: "percentage",
    openingFeeValue: 1.5,
    collectionFeePerInstallment: 1.5,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
    durationTerms: [
      { durationMonths: 12, minimumAmount: 900, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 18, minimumAmount: 760, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 24, minimumAmount: 760, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 36, minimumAmount: 766, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 48, minimumAmount: 958, maximumAmount: 20000, internalCostPercent: 0 },
    ],
  },
  {
    tableCode: "NBS",
    productCode: "NBS",
    displayName: "NBS – Standard 60 giorni",
    description: "Agos PCG 2026 – Standard, prima rata 60 giorni.",
    category: "standard",
    customerTanPercent: 10.5,
    openingFeeType: "percentage",
    openingFeeValue: 1.5,
    collectionFeePerInstallment: 1.5,
    firstInstallmentDelayDays: [60],
    requiresManagerAuthorizationNotice: false,
    durationTerms: [
      { durationMonths: 12, minimumAmount: 700, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 18, minimumAmount: 700, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 24, minimumAmount: 700, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 36, minimumAmount: 750, maximumAmount: 20000, internalCostPercent: 0 },
      { durationMonths: 48, minimumAmount: 950, maximumAmount: 20000, internalCostPercent: 0 },
    ],
  },
  {
    tableCode: "PR3",
    productCode: "PR3",
    displayName: "PR3 – Piccoli importi",
    description: "Agos PCG 2026 – Piccoli importi.",
    category: "small_amount",
    customerTanPercent: 9,
    openingFeeType: "none",
    openingFeeValue: 0,
    collectionFeePerInstallment: 0,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
    durationTerms: [
      { durationMonths: 6, minimumAmount: 200, maximumAmount: 1500, internalCostPercent: 0 },
      { durationMonths: 9, minimumAmount: 200, maximumAmount: 1500, internalCostPercent: 0 },
      { durationMonths: 12, minimumAmount: 200, maximumAmount: 1500, internalCostPercent: 0 },
      { durationMonths: 15, minimumAmount: 226, maximumAmount: 1500, internalCostPercent: 0 },
      { durationMonths: 18, minimumAmount: 268, maximumAmount: 1500, internalCostPercent: 0 },
      { durationMonths: 20, minimumAmount: 295, maximumAmount: 1500, internalCostPercent: 0 },
    ],
  },
  {
    tableCode: "PCA",
    productCode: "PCA",
    displayName: "PCA – Tasso zero 30 giorni",
    description:
      "Agos PCG 2026 – Tasso zero 30 giorni. Policy aziendale: max €5.000 / max 18 mesi.",
    category: "zero_interest",
    customerTanPercent: 0,
    openingFeeType: "fixed",
    openingFeeValue: 100,
    collectionFeePerInstallment: 1.5,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: true,
    durationTerms: [
      {
        durationMonths: 12,
        minimumAmount: 1500,
        maximumAmount: 5000,
        internalCostPercent: 4.44,
      },
      {
        durationMonths: 18,
        minimumAmount: 1500,
        maximumAmount: 5000,
        internalCostPercent: 6.61,
      },
    ],
  },
  {
    tableCode: "PCJ",
    productCode: "PCJ",
    displayName: "PCJ – Tasso zero 60 giorni",
    description:
      "Agos PCG 2026 – Tasso zero 60 giorni. Policy aziendale: max €5.000 / max 18 mesi.",
    category: "zero_interest",
    customerTanPercent: 0,
    openingFeeType: "fixed",
    openingFeeValue: 100,
    collectionFeePerInstallment: 1.5,
    firstInstallmentDelayDays: [60],
    requiresManagerAuthorizationNotice: true,
    durationTerms: [
      {
        durationMonths: 12,
        minimumAmount: 1500,
        maximumAmount: 5000,
        internalCostPercent: 5.22,
      },
      {
        durationMonths: 18,
        minimumAmount: 1500,
        maximumAmount: 5000,
        internalCostPercent: 7.33,
      },
    ],
  },
  {
    tableCode: "PV2",
    productCode: "PV2",
    displayName: "PV2 – Tasso agevolato",
    description:
      "Agos PCG 2026 – Tasso agevolato. Policy aziendale: max €7.000 / max 36 mesi.",
    category: "subsidized",
    customerTanPercent: 7,
    openingFeeType: "fixed",
    openingFeeValue: 100,
    collectionFeePerInstallment: 1.5,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: true,
    durationTerms: [
      {
        durationMonths: 12,
        minimumAmount: 2130,
        maximumAmount: 7000,
        internalCostPercent: 1.6,
      },
      {
        durationMonths: 18,
        minimumAmount: 1578,
        maximumAmount: 7000,
        internalCostPercent: 2.35,
      },
      {
        durationMonths: 24,
        minimumAmount: 1500,
        maximumAmount: 7000,
        internalCostPercent: 3.05,
      },
      {
        durationMonths: 36,
        minimumAmount: 1500,
        maximumAmount: 7000,
        internalCostPercent: 4.8,
      },
    ],
  },
  {
    tableCode: "AGOS_PASS_12",
    productCode: "AGOS_PASS",
    displayName: "Agos Pass",
    description:
      "Rappresentazione semplificata RataSmart del piano Agos Pass: durate da 3 a 12 mesi (step 1).",
    category: "special",
    customerTanPercent: 10.5,
    openingFeeType: "none",
    openingFeeValue: 0,
    collectionFeePerInstallment: 0,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
    adminNotes:
      "Codice interno RataSmart. Non rappresenta un codice tabella ufficiale Agos. Durate 3–12 mesi.",
    durationTerms: Array.from({ length: 10 }, (_, index) => ({
      durationMonths: index + 3,
      minimumAmount: 99,
      maximumAmount: 1500,
      internalCostPercent: 0,
    })),
  },
];

export const AGOS_PCG_CODES_TO_DEACTIVATE = [
  "AGOS_PASS_DEMO",
  "NBJ",
  "NBM",
] as const;

export function buildTableEconomicsFromSeed(seed: AgosPcgTableSeed) {
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
    collectionFeePerInstallment: seed.collectionFeePerInstallment,
    durationTerms: seed.durationTerms,
    firstInstallmentDelayDays: seed.firstInstallmentDelayDays,
    requiresManagerAuthorizationNotice: seed.requiresManagerAuthorizationNotice,
  };
}

function sortTerms(
  terms: DurationTerm[],
): Array<Record<string, number | undefined>> {
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

/** Confronto economico per seed idempotente. */
export function tableEconomicsMatchSeed(
  existing: {
    minimumAmount: number;
    maximumAmount: number;
    minimumDurationMonths: number;
    maximumDurationMonths: number;
    durationStepMonths: number;
    customerTanPercent: number;
    openingFeeType: string;
    openingFeeValue: number;
    collectionFeePerInstallment: number;
    internalCostPercentAt24Months?: number;
    durationTerms?: DurationTerm[];
    firstInstallmentDelayDays: number[];
    requiresManagerAuthorizationNotice: boolean;
    displayName: string;
    category: string;
    adminNotes?: string;
  },
  seed: AgosPcgTableSeed,
): boolean {
  const expected = buildTableEconomicsFromSeed(seed);
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
    JSON.stringify(sortTerms(expected.durationTerms))
  ) {
    return false;
  }
  if ((existing.adminNotes ?? undefined) !== (seed.adminNotes ?? undefined)) {
    return false;
  }
  return true;
}
