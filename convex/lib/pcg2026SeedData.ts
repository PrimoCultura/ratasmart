import type { DurationTerm } from "../../shared/financial-engine/duration-terms.ts";
import { envelopeFromDurationTerms } from "../../shared/financial-engine/duration-terms.ts";

export type PcgTableSeed = {
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
    | "special";
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: "none" | "fixed" | "percentage_of_requested_amount";
  installmentFeeValue?: number;
  internalCostBase?: "requested_amount" | "financed_amount";
  firstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
  adminNotes?: string;
  /** Se assente, usa min/max/step classici. */
  durationTerms?: DurationTerm[];
  minimumAmount?: number;
  maximumAmount?: number;
  minimumDurationMonths?: number;
  maximumDurationMonths?: number;
  durationStepMonths?: number;
};

export function buildTableEconomicsFromPcgSeed(seed: PcgTableSeed) {
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

export function tableEconomicsMatchPcgSeed(
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
    installmentFeeType?: string;
    installmentFeeValue?: number;
    internalCostPercentAt24Months?: number;
    internalCostBase?: string;
    durationTerms?: DurationTerm[];
    firstInstallmentDelayDays: number[];
    requiresManagerAuthorizationNotice: boolean;
    displayName: string;
    category: string;
    adminNotes?: string;
  },
  seed: PcgTableSeed,
): boolean {
  const expected = buildTableEconomicsFromPcgSeed(seed);
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
  if ((existing.installmentFeeType ?? undefined) !== (expected.installmentFeeType ?? undefined)) {
    return false;
  }
  if ((existing.installmentFeeValue ?? undefined) !== (expected.installmentFeeValue ?? undefined)) {
    return false;
  }
  if ((existing.internalCostBase ?? undefined) !== (expected.internalCostBase ?? undefined)) {
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

/** Deutsche Bank PCG 2026 */
export const DEUTSCHE_BANK_PCG_TABLES: PcgTableSeed[] = [
  {
    tableCode: "SJ=",
    productCode: "SJ=",
    productName: "SJ= – Piccoli importi",
    displayName: "SJ= – Piccoli importi",
    description: "Deutsche Bank PCG 2026 – piccoli importi.",
    category: "small_amount",
    minimumAmount: 600,
    maximumAmount: 1599,
    minimumDurationMonths: 6,
    maximumDurationMonths: 24,
    durationStepMonths: 1,
    customerTanPercent: 9.5,
    openingFeeType: "none",
    openingFeeValue: 0,
    collectionFeePerInstallment: 3,
    installmentFeeType: "fixed",
    installmentFeeValue: 3,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
  },
  {
    tableCode: "MUE",
    productCode: "MUE",
    productName: "MUE – Standard",
    displayName: "MUE – Standard",
    description: "Deutsche Bank PCG 2026 – fascia intermedia.",
    category: "standard",
    minimumAmount: 1600,
    maximumAmount: 2599,
    minimumDurationMonths: 12,
    maximumDurationMonths: 24,
    durationStepMonths: 1,
    customerTanPercent: 10.5,
    openingFeeType: "percentage",
    openingFeeValue: 1.5,
    collectionFeePerInstallment: 3,
    installmentFeeType: "fixed",
    installmentFeeValue: 3,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
  },
  {
    tableCode: "S/U",
    productCode: "S/U",
    productName: "S/U – Standard",
    displayName: "S/U – Standard",
    description: "Deutsche Bank PCG 2026 – importi elevati (max RataSmart €20.000).",
    category: "standard",
    minimumAmount: 2600,
    maximumAmount: 20000,
    minimumDurationMonths: 24,
    maximumDurationMonths: 72,
    durationStepMonths: 1,
    customerTanPercent: 10.5,
    openingFeeType: "percentage",
    openingFeeValue: 2.5,
    collectionFeePerInstallment: 3,
    installmentFeeType: "fixed",
    installmentFeeValue: 3,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
  },
  {
    tableCode: "S8L",
    productCode: "S8L",
    productName: "S8L – Tasso zero",
    displayName: "S8L – Tasso zero",
    description:
      "Deutsche Bank PCG 2026 – tasso zero. Costo aziendale su importo richiesto.",
    category: "zero_interest",
    customerTanPercent: 0,
    openingFeeType: "percentage",
    openingFeeValue: 2.5,
    collectionFeePerInstallment: 3,
    installmentFeeType: "fixed",
    installmentFeeValue: 3,
    internalCostBase: "requested_amount",
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: true,
    adminNotes:
      "Costo aziendale esplicito da 9,50% a 24 mesi: 4,75% @12 / 7,125% @18 sull'importo richiesto. Minimo importo non esplicitato nelle specifiche di fase: impostato a 600 €.",
    durationTerms: [
      {
        durationMonths: 12,
        minimumAmount: 600,
        maximumAmount: 3000,
        internalCostPercent: 4.75,
      },
      {
        durationMonths: 18,
        minimumAmount: 600,
        maximumAmount: 3000,
        internalCostPercent: 7.125,
      },
    ],
  },
];

/** Compass PCG 2026 */
export const COMPASS_PCG_TABLES: PcgTableSeed[] = [
  {
    tableCode: "81K",
    productCode: "81K",
    productName: "81K – Standard",
    displayName: "81K – Standard",
    description: "Compass PCG 2026 – standard.",
    category: "standard",
    minimumAmount: 1000,
    maximumAmount: 30000,
    minimumDurationMonths: 12,
    maximumDurationMonths: 84,
    durationStepMonths: 1,
    customerTanPercent: 10.5,
    openingFeeType: "percentage",
    openingFeeValue: 3,
    collectionFeePerInstallment: 0,
    installmentFeeType: "none",
    installmentFeeValue: 0,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
  },
  {
    tableCode: "NE9",
    productCode: "NE9",
    productName: "NE9 – Piccoli importi",
    displayName: "NE9 – Piccoli importi",
    description:
      "Compass PCG 2026 – piccoli importi. Commissione 0,6% dell'importo richiesto su ogni rata (non è TAN).",
    category: "small_amount",
    minimumAmount: 300,
    maximumAmount: 1500,
    minimumDurationMonths: 10,
    maximumDurationMonths: 48,
    durationStepMonths: 1,
    customerTanPercent: 0,
    openingFeeType: "none",
    openingFeeValue: 0,
    collectionFeePerInstallment: 0,
    installmentFeeType: "percentage_of_requested_amount",
    installmentFeeValue: 0.6,
    firstInstallmentDelayDays: [30],
    requiresManagerAuthorizationNotice: false,
    adminNotes:
      "La commissione 0,6%/rata è spesa per rata sull'importo richiesto, non TAN e non costo aziendale.",
  },
];
