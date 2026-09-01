import { format } from "date-fns";
import { it } from "date-fns/locale";

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return euroFormatter.format(value);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return numberFormatter.format(value);
}

export function formatDateTime(timestamp: number): string {
  return format(new Date(timestamp), "d MMM yyyy, HH:mm", { locale: it });
}

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), "d MMMM yyyy", { locale: it });
}

export function parseItalianAmount(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // Accetta "1.234,56" oppure "1234.56" / "1234,56"
  const normalized = trimmed.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return value;
}
