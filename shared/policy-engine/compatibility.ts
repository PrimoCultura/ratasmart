import { evaluatePolicyRule } from "./rule-evaluators.ts";
import type {
  CompatibilityEvaluation,
  PatientFinancialProfile,
  RuntimePolicyRule,
} from "./types.ts";

export function evaluateCompatibility(input: {
  patient: PatientFinancialProfile;
  requestedAmount: number;
  durationMonths: number;
  firstInstallmentDelayDays: number;
  calculationDate: number;
  rules: RuntimePolicyRule[];
}): CompatibilityEvaluation {
  const evaluations = input.rules.map((rule) =>
    evaluatePolicyRule(rule, {
      patient: input.patient,
      requestedAmount: input.requestedAmount,
      durationMonths: input.durationMonths,
      firstInstallmentDelayDays: input.firstInstallmentDelayDays,
      calculationDate: input.calculationDate,
    }),
  );

  const passedRules = evaluations.filter((item) => item.status === "passed");
  const failedRules = evaluations.filter((item) => item.status === "failed");
  const verificationRules = evaluations.filter(
    (item) => item.status === "verification_required",
  );
  const notApplicableRules = evaluations.filter(
    (item) => item.status === "not_applicable",
  );

  const reasons = failedRules
    .map((item) => item.message)
    .filter((message): message is string => Boolean(message));
  const verificationReasons = verificationRules
    .map((item) => item.message)
    .filter((message): message is string => Boolean(message));

  let status: CompatibilityEvaluation["status"] = "compatible";
  if (failedRules.length > 0) {
    status = "not_compatible";
  } else if (verificationRules.length > 0) {
    status = "verification_required";
  }

  return {
    status,
    passedRules,
    failedRules,
    verificationRules,
    notApplicableRules,
    reasons,
    verificationReasons,
  };
}
