import { calculateFinancingEndDate } from "../policy-engine/date-utils.ts";
import type { PatientFinancialProfile } from "../policy-engine/types.ts";
import type {
  BlockingConstraint,
  BlockingConstraintType,
} from "./diagnostic-types.ts";

function formatItDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function mapRuleType(ruleType: string): BlockingConstraintType {
  switch (ruleType) {
    case "temporary_contract_expiry":
      return "temporary_contract_expiry";
    case "residence_permit_expiry":
      return "residence_permit_expiry";
    case "minimum_age":
    case "maximum_age_at_application":
    case "maximum_age_at_end":
      return "age";
    case "minimum_amount":
    case "maximum_amount":
    case "maximum_amount_for_employment_types":
      return "amount";
    case "minimum_duration":
    case "maximum_duration":
      return "duration";
    case "employment_type_allowed":
    case "minimum_employment_seniority_months":
    case "pensioner_allowed":
      return "employment";
    case "guarantor_required_for_employment_types":
      return "guarantor";
    default:
      return "other";
  }
}

function labelForType(type: BlockingConstraintType): string {
  switch (type) {
    case "temporary_contract_expiry":
      return "Contratto a tempo determinato";
    case "residence_permit_expiry":
      return "Permesso di soggiorno";
    case "age":
      return "Età";
    case "amount":
      return "Importo";
    case "duration":
      return "Durata";
    case "employment":
      return "Situazione lavorativa";
    case "guarantor":
      return "Garante";
    default:
      return "Altro vincolo";
  }
}

export type FailedRuleSignal = {
  ruleType: string;
  message?: string;
  companyShortName: string;
  severity: "blocking" | "verification";
};

/**
 * Aggrega i motivi di esclusione dalle soluzioni non compatibili.
 * Non elenca tabella per tabella.
 */
export function analyzeBlockingConstraints(input: {
  patient: PatientFinancialProfile;
  calculationDate: number;
  selectedDurationMonths: number;
  firstInstallmentDelayDays: number;
  failedRules: FailedRuleSignal[];
}): {
  blockingConstraints: BlockingConstraint[];
  primaryConstraint?: BlockingConstraint;
} {
  const byType = new Map<
    BlockingConstraintType,
    {
      messages: Set<string>;
      companies: Set<string>;
      severity: "blocking" | "verification";
    }
  >();

  for (const signal of input.failedRules) {
    // La scadenza contratto non è un vincolo per il tempo indeterminato.
    if (
      signal.ruleType === "temporary_contract_expiry" &&
      input.patient.employmentType !== "temporary_employee"
    ) {
      continue;
    }
    const type = mapRuleType(signal.ruleType);
    const entry = byType.get(type) ?? {
      messages: new Set<string>(),
      companies: new Set<string>(),
      severity: signal.severity,
    };
    if (signal.message) entry.messages.add(signal.message);
    entry.companies.add(signal.companyShortName);
    if (signal.severity === "blocking") entry.severity = "blocking";
    byType.set(type, entry);
  }

  // Arricchisci vincoli temporali anche se presenti solo nel profilo paziente
  // e tutte le soluzioni falliscono per fine piano.
  const constraints: BlockingConstraint[] = [];

  for (const [type, entry] of byType) {
    let reason = [...entry.messages][0] ?? labelForType(type);
    let value: string | number | undefined;
    let requiredValue: string | number | undefined;

    if (
      type === "temporary_contract_expiry" &&
      input.patient.temporaryContractExpiry !== undefined
    ) {
      value = formatItDate(input.patient.temporaryContractExpiry);
      const end = calculateFinancingEndDate({
        calculationDate: input.calculationDate,
        durationMonths: input.selectedDurationMonths,
        firstInstallmentDelayDays: input.firstInstallmentDelayDays,
      });
      requiredValue = formatItDate(end);
      reason = `Scadenza ${value}. Con la durata selezionata il piano terminerebbe il ${requiredValue}, oltre la scadenza del contratto.`;
    }

    if (
      type === "residence_permit_expiry" &&
      input.patient.residencePermitExpiry !== undefined
    ) {
      value = formatItDate(input.patient.residencePermitExpiry);
      const end = calculateFinancingEndDate({
        calculationDate: input.calculationDate,
        durationMonths: input.selectedDurationMonths,
        firstInstallmentDelayDays: input.firstInstallmentDelayDays,
      });
      requiredValue = formatItDate(end);
      reason = `Scadenza ${value}. Con la durata selezionata il piano terminerebbe il ${requiredValue}, oltre la validità del permesso.`;
    }

    constraints.push({
      type,
      label: labelForType(type),
      reason,
      affectedCompanies: [...entry.companies].sort(),
      severity: entry.severity,
      value,
      requiredValue,
    });
  }

  // Se il paziente ha scadenze note ma non sono emerse dalle regole (es. solo
  // esclusione tecnica), aggiungi vincoli temporali espliciti.
  if (
    input.patient.employmentType === "temporary_employee" &&
    input.patient.temporaryContractExpiry !== undefined &&
    !constraints.some((item) => item.type === "temporary_contract_expiry")
  ) {
    const end = calculateFinancingEndDate({
      calculationDate: input.calculationDate,
      durationMonths: input.selectedDurationMonths,
      firstInstallmentDelayDays: input.firstInstallmentDelayDays,
    });
    if (end > input.patient.temporaryContractExpiry) {
      constraints.push({
        type: "temporary_contract_expiry",
        label: labelForType("temporary_contract_expiry"),
        reason:
          "Nessuno dei prodotti disponibili può concludersi entro questa data. La scadenza del contratto è troppo vicina per completare qualsiasi piano disponibile.",
        affectedCompanies: [],
        severity: "blocking",
        value: formatItDate(input.patient.temporaryContractExpiry),
        requiredValue: formatItDate(end),
      });
    }
  }

  if (
    input.patient.isNonEuCitizen &&
    input.patient.residencePermitExpiry !== undefined &&
    !input.patient.hasResidencePermitRenewalReceiptOnly &&
    !constraints.some((item) => item.type === "residence_permit_expiry")
  ) {
    const end = calculateFinancingEndDate({
      calculationDate: input.calculationDate,
      durationMonths: input.selectedDurationMonths,
      firstInstallmentDelayDays: input.firstInstallmentDelayDays,
    });
    if (end > input.patient.residencePermitExpiry) {
      constraints.push({
        type: "residence_permit_expiry",
        label: labelForType("residence_permit_expiry"),
        reason:
          "Anche il permesso di soggiorno limita la durata massima del piano.",
        affectedCompanies: [],
        severity: "blocking",
        value: formatItDate(input.patient.residencePermitExpiry),
        requiredValue: formatItDate(end),
      });
    }
  }

  const primaryConstraint = pickPrimaryConstraint(
    constraints,
    input.patient,
  );

  return { blockingConstraints: constraints, primaryConstraint };
}

/**
 * Tra i vincoli temporali, il più restrittivo è quello con scadenza più vicina.
 */
export function pickPrimaryConstraint(
  constraints: BlockingConstraint[],
  patient: PatientFinancialProfile,
): BlockingConstraint | undefined {
  const temporal = constraints.filter(
    (item) =>
      item.type === "temporary_contract_expiry" ||
      item.type === "residence_permit_expiry",
  );

  if (temporal.length === 0) {
    return constraints.find((item) => item.severity === "blocking") ?? constraints[0];
  }

  const withTs = temporal.map((item) => {
    const ts =
      item.type === "temporary_contract_expiry"
        ? patient.temporaryContractExpiry
        : patient.residencePermitExpiry;
    return { item, ts: ts ?? Number.POSITIVE_INFINITY };
  });
  withTs.sort((a, b) => a.ts - b.ts);
  return withTs[0]?.item;
}

export function formatItDateExport(timestamp: number): string {
  return formatItDate(timestamp);
}
