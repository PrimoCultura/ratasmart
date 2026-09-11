/**
 * Diagnostica deterministica delle alternative di confronto.
 * Non usa AI; riusa policy-engine e vincoli delle tabelle attive.
 */

export const ALTERNATIVE_DIAGNOSTICS_VERSION = "1.0.0";

export type BlockingConstraintType =
  | "temporary_contract_expiry"
  | "residence_permit_expiry"
  | "age"
  | "amount"
  | "duration"
  | "employment"
  | "guarantor"
  | "other";

export type BlockingConstraint = {
  type: BlockingConstraintType;
  label: string;
  reason: string;
  affectedCompanies: string[];
  severity: "blocking" | "verification";
  value?: string | number;
  requiredValue?: string | number;
};

export type AlternativeScenarioType =
  | "shorter_duration"
  | "lower_amount"
  | "lower_amount_and_shorter_duration"
  | "renew_contract"
  | "renew_residence_permit";

export type AlternativeScenario = {
  type: AlternativeScenarioType;
  companyId?: string;
  companyName?: string;
  tableId?: string;
  tableCode?: string;
  requiredAmountMax?: number;
  durationMonths?: number;
  requiredContractValidUntil?: string;
  requiredPermitValidUntil?: string;
  explanation: string;
  certainty: "deterministic" | "requires_verification";
};

export type InformationalSuggestion = {
  type: "guarantor" | "other";
  message: string;
};

export type ComparisonDiagnostics = {
  version: string;
  hasCompatibleSolutions: boolean;
  blockingConstraints: BlockingConstraint[];
  primaryConstraint?: BlockingConstraint;
  nearestAlternatives: AlternativeScenario[];
  informationalSuggestions: InformationalSuggestion[];
};
