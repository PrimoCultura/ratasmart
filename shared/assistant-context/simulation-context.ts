import type {
  AnonymizedSimulationContextInput,
  AnonymizedSolutionSummary,
  ChatPrivacyMode,
} from "./types.ts";
import { EMPLOYMENT_TYPE_LABELS, isPatientSafe } from "./privacy.ts";

function formatEuro(value?: number): string {
  if (value === undefined) return "n/d";
  return `€${value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: number): string | undefined {
  if (value === undefined) return undefined;
  return new Date(value).toLocaleDateString("it-IT");
}

function filterSolutionForPrivacy(
  solution: AnonymizedSolutionSummary,
  privacyMode: ChatPrivacyMode,
): AnonymizedSolutionSummary {
  if (!isPatientSafe(privacyMode)) {
    return solution;
  }
  return {
    companyShortName: solution.companyShortName,
    companyName: solution.companyName,
    productName: solution.productName,
    productCode: solution.productCode,
    tableCode: solution.tableCode,
    tableDisplayName: solution.tableDisplayName,
    resultGroup: solution.resultGroup,
    reasons: solution.reasons,
    verificationReasons: solution.verificationReasons,
    technicalExclusionReasons: solution.technicalExclusionReasons,
    regularTotalInstallmentAmount: solution.regularTotalInstallmentAmount,
    taegPercent: solution.taegPercent,
    customerTanPercent: solution.customerTanPercent,
    durationMonths: solution.durationMonths,
    financedAmount: solution.financedAmount,
    distanceFromTargetInstallment: solution.distanceFromTargetInstallment,
    requiresManagerAuthorizationNotice:
      solution.requiresManagerAuthorizationNotice,
  };
}

function formatSolutionBlock(
  solution: AnonymizedSolutionSummary,
  privacyMode: ChatPrivacyMode,
): string {
  const filtered = filterSolutionForPrivacy(solution, privacyMode);
  const lines = [
    `- ${filtered.companyShortName} / ${filtered.productName} (${filtered.tableCode})`,
    `  Stato: ${filtered.resultGroup}`,
  ];
  if (filtered.regularTotalInstallmentAmount !== undefined) {
    lines.push(`  Rata totale: ${formatEuro(filtered.regularTotalInstallmentAmount)}`);
  }
  if (filtered.customerTanPercent !== undefined) {
    lines.push(`  TAN: ${filtered.customerTanPercent}%`);
  }
  if (filtered.taegPercent !== undefined) {
    lines.push(`  TAEG tecnico: ${filtered.taegPercent}%`);
  }
  if (filtered.durationMonths !== undefined) {
    lines.push(`  Durata: ${filtered.durationMonths} mesi`);
  }
  if (filtered.distanceFromTargetInstallment !== undefined) {
    lines.push(
      `  Distanza da rata obiettivo: ${formatEuro(filtered.distanceFromTargetInstallment)}`,
    );
  }
  if (filtered.reasons.length > 0) {
    lines.push(`  Motivi: ${filtered.reasons.join("; ")}`);
  }
  if (filtered.verificationReasons.length > 0) {
    lines.push(`  Da verificare: ${filtered.verificationReasons.join("; ")}`);
  }
  if (filtered.technicalExclusionReasons.length > 0) {
    lines.push(
      `  Esclusioni tecniche: ${filtered.technicalExclusionReasons.join("; ")}`,
    );
  }
  if (!isPatientSafe(privacyMode)) {
    if (filtered.isCompanyPriority) {
      lines.push(
        `  Priorità aziendale: ${filtered.priorityLabel ?? "sì"} (score ${filtered.priorityScore ?? 0})`,
      );
      if (filtered.priorityVisibleReason) {
        lines.push(`  Motivo priorità: ${filtered.priorityVisibleReason}`);
      }
    }
    if (filtered.internalCostAmount !== undefined) {
      lines.push(`  Costo aziendale: ${formatEuro(filtered.internalCostAmount)}`);
    }
    if (filtered.netAmountPaidToCompany !== undefined) {
      lines.push(
        `  Netto liquidato azienda: ${formatEuro(filtered.netAmountPaidToCompany)}`,
      );
    }
    if (filtered.internalMessages && filtered.internalMessages.length > 0) {
      for (const message of filtered.internalMessages) {
        lines.push(
          `  Messaggio interno (${message.messageType}): ${message.title} – ${message.message}`,
        );
      }
    }
  }
  if (filtered.requiresManagerAuthorizationNotice) {
    lines.push("  Attenzione: può richiedere autorizzazione del responsabile.");
  }
  return lines.join("\n");
}

/**
 * Contesto anonimo della simulazione: nessuna identità paziente/clinica.
 */
export function buildAnonymizedSimulationContext(
  input: AnonymizedSimulationContextInput,
): string {
  const { patient, privacyMode } = input;
  const employment =
    patient.employmentType !== undefined
      ? (EMPLOYMENT_TYPE_LABELS[patient.employmentType] ??
        patient.employmentType)
      : "n/d";

  const ageDisplay =
    patient.ageAtReferenceDate ?? patient.age ?? "n/d";
  const header = [
    "CONTESTO DELLA SIMULAZIONE",
    "",
    `Rete: ${input.network}`,
    `Età: ${ageDisplay}${typeof ageDisplay === "number" ? " anni" : ""}`,
  ];
  if (patient.birthDate) {
    header.push(`Data di nascita: ${patient.birthDate}`);
  }
  header.push(`Condizione lavorativa: ${employment}`);

  const contractExpiry = formatDate(patient.temporaryContractExpiry);
  if (contractExpiry) {
    header.push(`Scadenza contratto: ${contractExpiry}`);
  }
  if (patient.isNonEuCitizen !== undefined) {
    header.push(
      `Cittadinanza extracomunitaria: ${patient.isNonEuCitizen ? "sì" : "no"}`,
    );
  }
  const permitExpiry = formatDate(patient.residencePermitExpiry);
  if (permitExpiry) {
    header.push(`Scadenza permesso: ${permitExpiry}`);
  }
  header.push(`Importo richiesto: ${formatEuro(input.requestedAmount)}`);
  if (input.selectedDurationMonths !== undefined) {
    header.push(`Durata confronto: ${input.selectedDurationMonths} mesi`);
  }
  if (input.targetInstallment !== undefined) {
    header.push(`Rata obiettivo: ${formatEuro(input.targetInstallment)}`);
  }
  if (input.selectedFirstInstallmentDelayDays !== undefined) {
    header.push(
      `Differimento prima rata: ${input.selectedFirstInstallmentDelayDays} giorni`,
    );
  }
  header.push(`Modalità privacy: ${privacyMode}`);

  const compatible = input.solutions.filter((s) => s.resultGroup === "compatible");
  const verification = input.solutions.filter(
    (s) => s.resultGroup === "verification_required",
  );
  const incompatible = input.solutions.filter(
    (s) => s.resultGroup === "not_compatible",
  );

  const sections = [header.join("\n")];

  sections.push(
    [
      "",
      "SOLUZIONI COMPATIBILI",
      compatible.length === 0
        ? "Nessuna"
        : compatible.map((s) => formatSolutionBlock(s, privacyMode)).join("\n"),
    ].join("\n"),
  );
  sections.push(
    [
      "",
      "SOLUZIONI DA VERIFICARE",
      verification.length === 0
        ? "Nessuna"
        : verification.map((s) => formatSolutionBlock(s, privacyMode)).join("\n"),
    ].join("\n"),
  );
  sections.push(
    [
      "",
      "SOLUZIONI NON COMPATIBILI",
      incompatible.length === 0
        ? "Nessuna"
        : incompatible.map((s) => formatSolutionBlock(s, privacyMode)).join("\n"),
    ].join("\n"),
  );

  if (input.proposedSolution) {
    sections.push(
      [
        "",
        "SOLUZIONE PROPOSTA",
        formatSolutionBlock(input.proposedSolution, privacyMode),
      ].join("\n"),
    );
  } else {
    sections.push(["", "SOLUZIONE PROPOSTA", "Nessuna"].join("\n"));
  }

  return sections.join("\n");
}
