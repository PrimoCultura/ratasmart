import { resolveAllowedDurations } from "../financial-engine/index.ts";
import {
  resolveTableEconomicsForDuration,
  type RuntimeFinancialTable,
} from "../policy-engine/comparison.ts";
import { calculateFinancingEndDate } from "../policy-engine/date-utils.ts";
import { evaluateCompatibility } from "../policy-engine/compatibility.ts";
import type {
  PatientFinancialProfile,
  RuntimePolicyRule,
} from "../policy-engine/types.ts";
import { formatItDateExport } from "./analyze-failure-reasons.ts";
import type { AlternativeScenario } from "./diagnostic-types.ts";

function technicalOk(
  table: RuntimeFinancialTable,
  amount: number,
  durationMonths: number,
  delayDays: number,
): boolean {
  if (!table.firstInstallmentDelayDays.includes(delayDays)) return false;
  const durations = resolveAllowedDurations(table);
  if (!durations.includes(durationMonths)) return false;
  const economics = resolveTableEconomicsForDuration(table, durationMonths);
  if (!economics) return false;
  if (amount < economics.minimumAmount || amount > economics.maximumAmount) {
    return false;
  }
  return true;
}

function evaluateCandidate(input: {
  table: RuntimeFinancialTable;
  companyName: string;
  amount: number;
  durationMonths: number;
  delayDays: number;
  patient: PatientFinancialProfile;
  calculationDate: number;
  rules: RuntimePolicyRule[];
}): { ok: boolean; verificationOnly: boolean } | null {
  if (
    !technicalOk(
      input.table,
      input.amount,
      input.durationMonths,
      input.delayDays,
    )
  ) {
    return null;
  }

  const compatibility = evaluateCompatibility({
    patient: input.patient,
    requestedAmount: input.amount,
    durationMonths: input.durationMonths,
    firstInstallmentDelayDays: input.delayDays,
    calculationDate: input.calculationDate,
    rules: input.rules,
  });

  if (compatibility.status === "compatible") {
    return { ok: true, verificationOnly: false };
  }
  if (compatibility.status === "verification_required") {
    return { ok: true, verificationOnly: true };
  }
  return null;
}

function financingFitsExpiries(input: {
  calculationDate: number;
  durationMonths: number;
  delayDays: number;
  patient: PatientFinancialProfile;
}): boolean {
  const end = calculateFinancingEndDate({
    calculationDate: input.calculationDate,
    durationMonths: input.durationMonths,
    firstInstallmentDelayDays: input.delayDays,
  });
  if (
    input.patient.employmentType === "temporary_employee" &&
    input.patient.temporaryContractExpiry !== undefined &&
    end > input.patient.temporaryContractExpiry
  ) {
    return false;
  }
  if (
    input.patient.isNonEuCitizen &&
    !input.patient.hasResidencePermitRenewalReceiptOnly &&
    input.patient.residencePermitExpiry !== undefined &&
    end > input.patient.residencePermitExpiry
  ) {
    return false;
  }
  return true;
}

/**
 * Cerca alternative deterministiche tra le tabelle attive.
 * Non inventa prodotti: valuta solo combinazioni realmente ammesse.
 */
export function findAlternativeScenarios(input: {
  requestedAmount: number;
  selectedDurationMonths: number;
  delayDays: number;
  calculationDate: number;
  patient: PatientFinancialProfile;
  tables: RuntimeFinancialTable[];
  companyNameById: Record<string, string>;
  rulesByTableId: Record<string, RuntimePolicyRule[]>;
  maxAlternatives?: number;
}): AlternativeScenario[] {
  const maxAlternatives = input.maxAlternatives ?? 8;
  const scenarios: AlternativeScenario[] = [];
  const seen = new Set<string>();

  const push = (scenario: AlternativeScenario) => {
    const key = [
      scenario.type,
      scenario.tableCode ?? "",
      scenario.durationMonths ?? "",
      scenario.requiredAmountMax ?? "",
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    scenarios.push(scenario);
  };

  // A/B: durata più breve e/o importo più basso su tabelle reali
  for (const table of input.tables) {
    if (!table.isActive) continue;
    const companyName =
      input.companyNameById[table.companyId] ?? table.companyId;
    const rules = input.rulesByTableId[table.id] ?? [];
    const durations = resolveAllowedDurations(table).filter(
      (duration) => duration > 0,
    );

    for (const duration of durations) {
      // Shorter duration at same amount
      if (duration < input.selectedDurationMonths) {
        const result = evaluateCandidate({
          table,
          companyName,
          amount: input.requestedAmount,
          durationMonths: duration,
          delayDays: input.delayDays,
          patient: input.patient,
          calculationDate: input.calculationDate,
          rules,
        });
        if (result?.ok) {
          push({
            type: "shorter_duration",
            companyId: table.companyId,
            companyName,
            tableId: table.id,
            tableCode: table.tableCode,
            durationMonths: duration,
            requiredAmountMax: input.requestedAmount,
            explanation: `Con durata ${duration} mesi potrebbe diventare disponibile ${companyName} ${table.tableCode}, rispettando i vincoli attuali.`,
            certainty: result.verificationOnly
              ? "requires_verification"
              : "deterministic",
          });
        }
      }

      // Lower amount (table/term max) at this duration
      const economics = resolveTableEconomicsForDuration(table, duration);
      if (!economics) continue;
      if (economics.maximumAmount >= input.requestedAmount) continue;

      const lowerAmount = economics.maximumAmount;
      const result = evaluateCandidate({
        table,
        companyName,
        amount: lowerAmount,
        durationMonths: duration,
        delayDays: input.delayDays,
        patient: input.patient,
        calculationDate: input.calculationDate,
        rules,
      });
      if (result?.ok) {
        push({
          type:
            duration < input.selectedDurationMonths
              ? "lower_amount_and_shorter_duration"
              : "lower_amount",
          companyId: table.companyId,
          companyName,
          tableId: table.id,
          tableCode: table.tableCode,
          durationMonths: duration,
          requiredAmountMax: lowerAmount,
          explanation: `Riducendo l’importo a massimo €${lowerAmount.toLocaleString("it-IT")} potrebbe diventare disponibile ${companyName} ${table.tableCode} a ${duration} mesi, se tutti gli altri requisiti risultano rispettati.`,
          certainty: result.verificationOnly
            ? "requires_verification"
            : "deterministic",
        });
      }
    }
  }

  // C: estensione scadenze necessarie per durate realmente disponibili
  const allDurations = [
    ...new Set(
      input.tables.flatMap((table) => resolveAllowedDurations(table)),
    ),
  ].sort((a, b) => a - b);

  for (const duration of allDurations) {
    if (!financingFitsExpiries({
      calculationDate: input.calculationDate,
      durationMonths: duration,
      delayDays: input.delayDays,
      patient: input.patient,
    })) {
      const end = calculateFinancingEndDate({
        calculationDate: input.calculationDate,
        durationMonths: duration,
        firstInstallmentDelayDays: input.delayDays,
      });
      const endLabel = formatItDateExport(end);

      // Solo se almeno una tabella tecnicamente ammette importo+durata
      const hasTechnicalTable = input.tables.some((table) =>
        technicalOk(
          table,
          input.requestedAmount,
          duration,
          input.delayDays,
        ),
      );
      if (!hasTechnicalTable) continue;

      if (
        input.patient.employmentType === "temporary_employee" &&
        input.patient.temporaryContractExpiry !== undefined &&
        end > input.patient.temporaryContractExpiry
      ) {
        push({
          type: "renew_contract",
          durationMonths: duration,
          requiredContractValidUntil: endLabel,
          explanation: `Una soluzione a ${duration} mesi potrebbe diventare valutabile se il contratto risultasse valido almeno fino al ${endLabel}.`,
          certainty: "requires_verification",
        });
      }

      if (
        input.patient.isNonEuCitizen &&
        !input.patient.hasResidencePermitRenewalReceiptOnly &&
        input.patient.residencePermitExpiry !== undefined &&
        end > input.patient.residencePermitExpiry
      ) {
        push({
          type: "renew_residence_permit",
          durationMonths: duration,
          requiredPermitValidUntil: endLabel,
          explanation: `Una soluzione a ${duration} mesi potrebbe diventare valutabile se il permesso di soggiorno risultasse valido almeno fino al ${endLabel}.`,
          certainty: "requires_verification",
        });
      }
    }
  }

  // Preferisci alternative economiche concrete rispetto ai soli rinnovi
  scenarios.sort((a, b) => {
    const rank = (type: AlternativeScenario["type"]) => {
      if (type === "shorter_duration") return 0;
      if (type === "lower_amount_and_shorter_duration") return 1;
      if (type === "lower_amount") return 2;
      return 3;
    };
    return rank(a.type) - rank(b.type) || (a.durationMonths ?? 99) - (b.durationMonths ?? 99);
  });

  return scenarios.slice(0, maxAlternatives);
}

/**
 * True se nessuna tabella attiva ha una durata che rispetta le scadenze
 * del profilo per l'importo richiesto (vincolo temporale assoluto).
 */
export function noDurationFitsTemporalWindow(input: {
  requestedAmount: number;
  delayDays: number;
  calculationDate: number;
  patient: PatientFinancialProfile;
  tables: RuntimeFinancialTable[];
}): boolean {
  for (const table of input.tables) {
    if (!table.isActive) continue;
    for (const duration of resolveAllowedDurations(table)) {
      if (
        !technicalOk(
          table,
          input.requestedAmount,
          duration,
          input.delayDays,
        )
      ) {
        continue;
      }
      if (
        financingFitsExpiries({
          calculationDate: input.calculationDate,
          durationMonths: duration,
          delayDays: input.delayDays,
          patient: input.patient,
        })
      ) {
        return false;
      }
    }
  }
  return true;
}
