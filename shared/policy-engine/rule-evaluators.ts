import {
  estimateAgeAtFinancingEnd,
  calculateFinancingEndDate,
} from "./date-utils.ts";
import type {
  PatientFinancialProfile,
  PolicyOperator,
  PolicyRuleType,
  RuleEvaluation,
  RuntimePolicyRule,
} from "./types.ts";

export type RuleEvaluationContext = {
  patient: PatientFinancialProfile;
  requestedAmount: number;
  durationMonths: number;
  firstInstallmentDelayDays: number;
  calculationDate: number;
};

function verification(
  rule: RuntimePolicyRule,
  technicalReason: string,
  message?: string,
): RuleEvaluation {
  return {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    status: "verification_required",
    message:
      message ??
      rule.verificationMessage ??
      rule.failureMessage ??
      "Verifica manuale richiesta.",
    technicalReason,
  };
}

function passed(rule: RuntimePolicyRule, message?: string): RuleEvaluation {
  return {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    status: "passed",
    message,
  };
}

function failed(rule: RuntimePolicyRule, message?: string): RuleEvaluation {
  return {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    status: "failed",
    message: message ?? rule.failureMessage,
  };
}

function notApplicable(rule: RuntimePolicyRule): RuleEvaluation {
  return {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    status: "not_applicable",
  };
}

function unsupportedOperator(rule: RuntimePolicyRule): RuleEvaluation {
  return verification(
    rule,
    "Operatore non gestito automaticamente per questa regola.",
    "Operatore non gestito automaticamente per questa regola.",
  );
}

function compareNumber(
  left: number,
  operator: PolicyOperator,
  right: number,
): boolean | null {
  switch (operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "greater_than":
      return left > right;
    case "greater_than_or_equal":
      return left >= right;
    case "less_than":
      return left < right;
    case "less_than_or_equal":
      return left <= right;
    default:
      return null;
  }
}

function evaluateAgeRule(
  rule: RuntimePolicyRule,
  age: number,
  defaultOperator: PolicyOperator,
): RuleEvaluation {
  if (rule.numericValue === undefined) {
    return verification(rule, "numericValue mancante");
  }
  const operator = rule.operator || defaultOperator;
  const result = compareNumber(age, operator, rule.numericValue);
  if (result === null) {
    return unsupportedOperator(rule);
  }
  return result ? passed(rule) : failed(rule);
}

export function evaluatePolicyRule(
  rule: RuntimePolicyRule,
  ctx: RuleEvaluationContext,
): RuleEvaluation {
  const { patient } = ctx;

  switch (rule.ruleType as PolicyRuleType) {
    case "minimum_age":
      return evaluateAgeRule(rule, patient.age, "greater_than_or_equal");

    case "maximum_age_at_application":
      return evaluateAgeRule(rule, patient.age, "less_than_or_equal");

    case "maximum_age_at_end": {
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      const ageAtEnd = estimateAgeAtFinancingEnd({
        age: patient.age,
        durationMonths: ctx.durationMonths,
        firstInstallmentDelayDays: ctx.firstInstallmentDelayDays,
      });
      const operator = rule.operator || "less_than_or_equal";
      const result = compareNumber(ageAtEnd, operator, rule.numericValue);
      if (result === null) {
        return unsupportedOperator(rule);
      }
      return result
        ? passed(
            rule,
            `Età stimata a fine piano: ${ageAtEnd.toFixed(2)} anni (anni compiuti dichiarati).`,
          )
        : failed(rule);
    }

    case "employment_type_allowed": {
      if (!rule.stringValues || rule.stringValues.length === 0) {
        return verification(rule, "stringValues assente o vuoto");
      }
      if (rule.operator !== "in" && rule.operator !== "equals") {
        // "in" preferred; equals with single value also ok if stringValue set
        if (rule.operator !== "not_in") {
          // still allow in/not_in primarily
        }
      }
      if (rule.operator === "in" || rule.operator === "equals") {
        const allowed = rule.stringValues.includes(patient.employmentType);
        return allowed ? passed(rule) : failed(rule);
      }
      if (rule.operator === "not_in") {
        const blocked = rule.stringValues.includes(patient.employmentType);
        return blocked ? failed(rule) : passed(rule);
      }
      return unsupportedOperator(rule);
    }

    case "pensioner_allowed": {
      if (patient.employmentType !== "pensioner") {
        return notApplicable(rule);
      }
      if (rule.booleanValue === undefined) {
        return verification(rule, "booleanValue mancante");
      }
      return rule.booleanValue ? passed(rule) : failed(rule);
    }

    case "non_eu_allowed": {
      if (!patient.isNonEuCitizen) {
        return notApplicable(rule);
      }
      if (rule.booleanValue === undefined) {
        return verification(rule, "booleanValue mancante");
      }
      return rule.booleanValue ? passed(rule) : failed(rule);
    }

    case "temporary_contract_expiry": {
      if (patient.employmentType !== "temporary_employee") {
        return notApplicable(rule);
      }
      if (patient.temporaryContractExpiry === undefined) {
        return verification(
          rule,
          "Scadenza contratto determinata mancante",
          rule.verificationMessage ??
            "Per un contratto a tempo determinato è necessario conoscere la data di scadenza del contratto per verificare che il finanziamento termini prima.",
        );
      }
      if (rule.operator !== "date_after_financing_end") {
        return unsupportedOperator(rule);
      }
      const end = calculateFinancingEndDate({
        calculationDate: ctx.calculationDate,
        durationMonths: ctx.durationMonths,
        firstInstallmentDelayDays: ctx.firstInstallmentDelayDays,
      });
      const bufferMonths = rule.monthsBuffer ?? 0;
      const requiredExpiry = new Date(end);
      requiredExpiry.setMonth(requiredExpiry.getMonth() + bufferMonths);
      const ok = patient.temporaryContractExpiry >= requiredExpiry.getTime();
      return ok ? passed(rule) : failed(rule);
    }

    case "residence_permit_expiry": {
      if (!patient.isNonEuCitizen) {
        return notApplicable(rule);
      }
      // Con sola ricevuta di rinnovo la scadenza del permesso non è utilizzabile qui.
      if (patient.hasResidencePermitRenewalReceiptOnly === true) {
        return notApplicable(rule);
      }
      if (patient.residencePermitExpiry === undefined) {
        return verification(
          rule,
          "Scadenza permesso di soggiorno mancante",
          rule.verificationMessage ??
            "Per un paziente extracomunitario è necessario conoscere la data di scadenza del permesso di soggiorno per verificare che il finanziamento termini entro la validità del permesso.",
        );
      }
      if (rule.operator !== "date_after_financing_end") {
        return unsupportedOperator(rule);
      }
      const end = calculateFinancingEndDate({
        calculationDate: ctx.calculationDate,
        durationMonths: ctx.durationMonths,
        firstInstallmentDelayDays: ctx.firstInstallmentDelayDays,
      });
      const bufferMonths = rule.monthsBuffer ?? 0;
      const requiredExpiry = new Date(end);
      requiredExpiry.setMonth(requiredExpiry.getMonth() + bufferMonths);
      const ok = patient.residencePermitExpiry >= requiredExpiry.getTime();
      return ok ? passed(rule) : failed(rule);
    }

    case "renewal_receipt_allowed": {
      if (!patient.isNonEuCitizen) {
        return notApplicable(rule);
      }
      if (patient.hasResidencePermitRenewalReceiptOnly !== true) {
        return notApplicable(rule);
      }
      if (rule.booleanValue === undefined) {
        return verification(rule, "booleanValue mancante");
      }
      if (rule.booleanValue === false) {
        return failed(rule);
      }
      return verification(
        rule,
        "Ricevuta di rinnovo dichiarata: valutazione documentale della finanziaria",
        rule.verificationMessage ?? rule.failureMessage,
      );
    }

    case "minimum_employment_seniority_months": {
      if (patient.employmentType !== "permanent_employee") {
        return notApplicable(rule);
      }
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      if (patient.employmentSeniorityMonths === undefined) {
        return verification(
          rule,
          "Anzianità lavorativa mancante",
          rule.verificationMessage ??
            "Indicare l’anzianità lavorativa in mesi per il tempo indeterminato.",
        );
      }
      const operator = rule.operator || "greater_than_or_equal";
      const result = compareNumber(
        patient.employmentSeniorityMonths,
        operator,
        rule.numericValue,
      );
      if (result === null) {
        return unsupportedOperator(rule);
      }
      // Indicazione operativa: sotto soglia → verifica, non blocco assoluto.
      return result
        ? passed(rule)
        : verification(
            rule,
            "Anzianità lavorativa inferiore alla soglia operativa",
            rule.verificationMessage ?? rule.failureMessage,
          );
    }

    case "maximum_amount_for_employment_types": {
      if (!rule.stringValues || rule.stringValues.length === 0) {
        return verification(rule, "stringValues assente o vuoto");
      }
      if (!rule.stringValues.includes(patient.employmentType)) {
        return notApplicable(rule);
      }
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      const operator = rule.operator || "less_than_or_equal";
      const result = compareNumber(
        ctx.requestedAmount,
        operator,
        rule.numericValue,
      );
      if (result === null) {
        return unsupportedOperator(rule);
      }
      return result ? passed(rule) : failed(rule);
    }

    case "guarantor_required_for_employment_types": {
      if (!rule.stringValues || rule.stringValues.length === 0) {
        return verification(rule, "stringValues assente o vuoto");
      }
      if (!rule.stringValues.includes(patient.employmentType)) {
        return notApplicable(rule);
      }
      if (patient.hasGuarantor === true) {
        return verification(
          rule,
          "Garante dichiarato: documentazione da verificare",
          rule.verificationMessage ??
            "Garante dichiarato: verificare reddito dimostrabile e ammissibilità formale.",
        );
      }
      return verification(
        rule,
        "Garante richiesto per il profilo dichiarato",
        rule.verificationMessage ?? rule.failureMessage,
      );
    }

    case "minimum_amount": {
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      const operator = rule.operator || "greater_than_or_equal";
      const result = compareNumber(ctx.requestedAmount, operator, rule.numericValue);
      if (result === null) return unsupportedOperator(rule);
      return result ? passed(rule) : failed(rule);
    }

    case "maximum_amount": {
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      const operator = rule.operator || "less_than_or_equal";
      const result = compareNumber(ctx.requestedAmount, operator, rule.numericValue);
      if (result === null) return unsupportedOperator(rule);
      return result ? passed(rule) : failed(rule);
    }

    case "minimum_duration": {
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      const operator = rule.operator || "greater_than_or_equal";
      const result = compareNumber(ctx.durationMonths, operator, rule.numericValue);
      if (result === null) return unsupportedOperator(rule);
      return result ? passed(rule) : failed(rule);
    }

    case "maximum_duration": {
      if (rule.numericValue === undefined) {
        return verification(rule, "numericValue mancante");
      }
      const operator = rule.operator || "less_than_or_equal";
      const result = compareNumber(ctx.durationMonths, operator, rule.numericValue);
      if (result === null) return unsupportedOperator(rule);
      return result ? passed(rule) : failed(rule);
    }

    case "custom":
      return verification(
        rule,
        "Regola custom non interpretata automaticamente",
        rule.verificationMessage ??
          rule.failureMessage ??
          "Regola personalizzata: verifica manuale richiesta.",
      );

    default:
      return verification(
        rule,
        `Tipo regola non gestito: ${String(rule.ruleType)}`,
      );
  }
}
