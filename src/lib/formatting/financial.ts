import { formatNumber } from "./currency";
import {
  generateDurationMonths,
  resolveTableDurationMonths,
} from "@/lib/constants/financial";
import type { OpeningFeeType } from "@/lib/constants/financial";

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${formatNumber(value)}%`;
}

export function formatDurationRange(
  minimum: number,
  maximum: number,
  step: number,
  durationTerms?: Array<{ durationMonths: number }> | null,
): string {
  const durations =
    durationTerms && durationTerms.length > 0
      ? resolveTableDurationMonths({
          minimumDurationMonths: minimum,
          maximumDurationMonths: maximum,
          durationStepMonths: step,
          durationTerms,
        })
      : generateDurationMonths(minimum, maximum, step);
  if (durations.length === 0) {
    return "—";
  }
  if (durations.length <= 8) {
    return `${durations.join(", ")} mesi`;
  }
  if (durationTerms && durationTerms.length > 0) {
    return `${durations[0]}–${durations[durations.length - 1]} mesi · ${durations.length} opzioni`;
  }
  return `${minimum}–${maximum} mesi (step ${step}) · ${durations.length} opzioni`;
}

export function formatOpeningFee(
  type: OpeningFeeType,
  value: number,
): string {
  if (type === "none") {
    return "Nessuna";
  }
  if (type === "fixed") {
    return `${formatNumber(value)} €`;
  }
  return formatPercent(value);
}

export function formatInstallmentFee(
  type: "none" | "fixed" | "percentage_of_requested_amount" | undefined,
  value: number | undefined,
  legacyFixedEuro: number,
): string {
  if (type === "percentage_of_requested_amount") {
    return `${formatNumber(value ?? 0)}% importo richiesto/rata`;
  }
  if (type === "none") {
    return "Nessuna";
  }
  const euro = type === "fixed" ? (value ?? legacyFixedEuro) : legacyFixedEuro;
  if (!euro) {
    return "Nessuna";
  }
  return `${formatNumber(euro)} €/rata`;
}

export function formatDelayDays(days: number[]): string {
  if (days.length === 0) {
    return "—";
  }
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => `${day} gg`)
    .join(" · ");
}
