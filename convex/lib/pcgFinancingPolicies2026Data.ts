import type { PolicyOperator, PolicyRuleType } from "../../shared/policy-engine/types";
import { PCG_2026_POLICY_CONSTANTS as C } from "../../shared/policy-engine/pcg-2026-constants";

export type PcgPolicyRuleSeed = {
  ruleType: PolicyRuleType;
  operator: PolicyOperator;
  numericValue?: number;
  stringValue?: string;
  booleanValue?: boolean;
  stringValues?: string[];
  monthsBuffer?: number;
  failureMessage: string;
  verificationMessage?: string;
  sortOrder: number;
};

export type PcgPolicySetSeed = {
  /** Chiave stabile per idempotenza (non è l’ID Convex). */
  stableKey: string;
  companyShortName: "Agos" | "Compass" | "Deutsche Bank";
  name: string;
  description: string;
  sourceReference: string;
  rules: PcgPolicyRuleSeed[];
};

const SHARED_MINIMUM_AGE: PcgPolicyRuleSeed = {
  ruleType: "minimum_age",
  operator: "greater_than_or_equal",
  numericValue: C.minimumAge,
  failureMessage:
    "Il finanziamento può essere intestato solo a una persona maggiorenne.",
  sortOrder: 10,
};

const SHARED_TEMPORARY_CONTRACT: PcgPolicyRuleSeed = {
  ruleType: "temporary_contract_expiry",
  operator: "date_after_financing_end",
  monthsBuffer: 0,
  failureMessage:
    "Con contratto a tempo determinato il finanziamento deve terminare prima della scadenza del contratto.",
  verificationMessage:
    "Per un contratto a tempo determinato è necessario conoscere la data di scadenza del contratto per verificare che il finanziamento termini prima.",
  sortOrder: 20,
};

const SHARED_RESIDENCE_PERMIT: PcgPolicyRuleSeed = {
  ruleType: "residence_permit_expiry",
  operator: "date_after_financing_end",
  monthsBuffer: 0,
  failureMessage:
    "Il finanziamento deve terminare entro la validità del permesso di soggiorno.",
  verificationMessage:
    "Per un paziente extracomunitario è necessario conoscere la data di scadenza del permesso di soggiorno per verificare che il finanziamento termini entro la validità del permesso.",
  sortOrder: 30,
};

const SHARED_SENIORITY: PcgPolicyRuleSeed = {
  ruleType: "minimum_employment_seniority_months",
  operator: "greater_than_or_equal",
  numericValue: C.seniorityMonths,
  failureMessage:
    "L’anzianità lavorativa indicata è inferiore ai 12 mesi previsti dalle indicazioni operative: verificare con la finanziaria.",
  verificationMessage:
    "L’anzianità lavorativa indicata è inferiore ai 12 mesi previsti dalle indicazioni operative: verificare con la finanziaria.",
  sortOrder: 40,
};

export const PCG_FINANCING_POLICY_SETS_2026: PcgPolicySetSeed[] = [
  {
    stableKey: "pcg-2026-agos-patient",
    companyShortName: "Agos",
    name: "PCG 2026 – Agos – requisiti paziente",
    description:
      "Policy formali PCG 2026 Agos: età a fine piano, profilo studente/casalinga, permesso e ricevuta di rinnovo.",
    sourceReference: "Indicazioni aziendali PCG 2026 – Agos",
    rules: [
      SHARED_MINIMUM_AGE,
      SHARED_TEMPORARY_CONTRACT,
      SHARED_RESIDENCE_PERMIT,
      SHARED_SENIORITY,
      {
        ruleType: "maximum_age_at_end",
        operator: "less_than_or_equal",
        numericValue: C.agosMaxAgeAtEnd,
        failureMessage:
          "Agos richiede che il piano termini entro il compimento degli 82 anni.",
        sortOrder: 50,
      },
      {
        ruleType: "employment_type_allowed",
        operator: "not_in",
        stringValues: ["student", "housewife"],
        failureMessage:
          "Agos non valuta profili studente o casalinga secondo le indicazioni aziendali PCG disponibili.",
        sortOrder: 60,
      },
      {
        ruleType: "renewal_receipt_allowed",
        operator: "equals",
        booleanValue: false,
        failureMessage:
          "Agos non accetta la sola ricevuta di rinnovo del permesso di soggiorno.",
        sortOrder: 70,
      },
      {
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: true,
        failureMessage:
          "Per Agos il paziente extracomunitario richiede permesso di soggiorno valido (non la sola ricevuta di rinnovo).",
        sortOrder: 80,
      },
    ],
  },
  {
    stableKey: "pcg-2026-compass-patient",
    companyShortName: "Compass",
    name: "PCG 2026 – Compass – requisiti paziente",
    description:
      "Policy formali PCG 2026 Compass: età caricamento/fine piano, studente/casalinga, permesso e ricevuta.",
    sourceReference: "Indicazioni aziendali PCG 2026 – Compass",
    rules: [
      SHARED_MINIMUM_AGE,
      SHARED_TEMPORARY_CONTRACT,
      SHARED_RESIDENCE_PERMIT,
      SHARED_SENIORITY,
      {
        ruleType: "maximum_age_at_application",
        operator: "less_than",
        numericValue: C.compassMaxAgeAtApplicationExclusive,
        failureMessage:
          "Compass richiede un’età inferiore a 75 anni al momento della richiesta.",
        sortOrder: 50,
      },
      {
        ruleType: "maximum_age_at_end",
        operator: "less_than_or_equal",
        numericValue: C.compassMaxAgeAtEnd,
        failureMessage:
          "Compass richiede che il piano termini entro il compimento degli 80 anni.",
        sortOrder: 55,
      },
      {
        ruleType: "maximum_amount_for_employment_types",
        operator: "less_than_or_equal",
        numericValue: C.studentHousewifeMaxAmountEur,
        stringValues: ["student", "housewife"],
        failureMessage:
          "Per studente/casalinga Compass ammette un importo massimo di 2.500 € sul profilo dichiarato.",
        sortOrder: 60,
      },
      {
        ruleType: "guarantor_required_for_employment_types",
        operator: "custom",
        stringValues: ["student"],
        failureMessage:
          "Per uno studente Compass richiede un garante con reddito dimostrabile.",
        verificationMessage:
          "Per uno studente Compass richiede un garante con reddito dimostrabile. La documentazione deve essere verificata dalla finanziaria.",
        sortOrder: 65,
      },
      {
        ruleType: "renewal_receipt_allowed",
        operator: "equals",
        booleanValue: true,
        failureMessage:
          "Compass può valutare una ricevuta di rinnovo valida e recente. La documentazione deve essere verificata dalla finanziaria.",
        verificationMessage:
          "Compass può valutare una ricevuta di rinnovo valida e recente. La documentazione deve essere verificata dalla finanziaria.",
        sortOrder: 70,
      },
      {
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: true,
        failureMessage:
          "Compass può valutare pazienti extracomunitari: verificare permesso o ricevuta di rinnovo.",
        sortOrder: 80,
      },
    ],
  },
  {
    stableKey: "pcg-2026-deutsche-bank-patient",
    companyShortName: "Deutsche Bank",
    name: "PCG 2026 – Deutsche Bank – requisiti paziente",
    description:
      "Policy formali PCG 2026 Deutsche Bank (tabelle SJ=, MUE, S/U, S8L; escluso Senior/COS).",
    sourceReference: "Indicazioni aziendali PCG 2026 – Deutsche Bank standard",
    rules: [
      SHARED_MINIMUM_AGE,
      SHARED_TEMPORARY_CONTRACT,
      SHARED_RESIDENCE_PERMIT,
      SHARED_SENIORITY,
      {
        ruleType: "maximum_age_at_application",
        operator: "less_than",
        numericValue: C.deutscheBankMaxAgeAtApplicationExclusive,
        failureMessage:
          "Deutsche Bank (prodotti standard attualmente caricati) richiede un’età inferiore a 79 anni al momento della richiesta.",
        sortOrder: 50,
      },
      {
        ruleType: "maximum_age_at_end",
        operator: "less_than_or_equal",
        numericValue: C.deutscheBankMaxAgeAtEnd,
        failureMessage:
          "Deutsche Bank richiede che il piano termini entro il compimento degli 80 anni.",
        sortOrder: 55,
      },
      {
        ruleType: "maximum_amount_for_employment_types",
        operator: "less_than_or_equal",
        numericValue: C.studentHousewifeMaxAmountEur,
        stringValues: ["student", "housewife"],
        failureMessage:
          "Per studente/casalinga Deutsche Bank ammette un importo massimo di 2.500 € sul profilo dichiarato.",
        sortOrder: 60,
      },
      {
        ruleType: "renewal_receipt_allowed",
        operator: "equals",
        booleanValue: true,
        failureMessage:
          "Deutsche Bank può valutare una ricevuta di rinnovo valida e recente. La documentazione deve essere verificata dalla finanziaria.",
        verificationMessage:
          "Deutsche Bank può valutare una ricevuta di rinnovo valida e recente. La documentazione deve essere verificata dalla finanziaria.",
        sortOrder: 70,
      },
      {
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: true,
        failureMessage:
          "Deutsche Bank può valutare pazienti extracomunitari: verificare permesso o ricevuta di rinnovo.",
        sortOrder: 80,
      },
    ],
  },
];

/** Fingerprint stabile delle regole per confrontare versioni. */
export function fingerprintPolicyRules(rules: PcgPolicyRuleSeed[]): string {
  const normalized = [...rules]
    .map((rule) => ({
      ruleType: rule.ruleType,
      operator: rule.operator,
      numericValue: rule.numericValue ?? null,
      stringValue: rule.stringValue ?? null,
      booleanValue: rule.booleanValue ?? null,
      stringValues: rule.stringValues ? [...rule.stringValues].sort() : null,
      monthsBuffer: rule.monthsBuffer ?? null,
      failureMessage: rule.failureMessage,
      verificationMessage: rule.verificationMessage ?? null,
      sortOrder: rule.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.ruleType.localeCompare(b.ruleType));
  return JSON.stringify(normalized);
}
