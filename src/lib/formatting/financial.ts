import { formatNumber } from "./currency";
import { generateDurationMonths } from "@/lib/constants/financial";
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
): string {
  const durations = generateDurationMonths(minimum, maximum, step);
  if (durations.length === 0) {
    return "—";
  }
  if (durations.length <= 8) {
    return `${durations.join(", ")} mesi`;
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
