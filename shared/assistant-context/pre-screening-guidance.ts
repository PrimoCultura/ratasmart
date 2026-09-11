import { normalizeText } from "../knowledge-engine/normalize.ts";
import type { PreScreeningContext, PreScreeningPolicyRule } from "./pre-screening-context.ts";

export type PreScreeningQuestionSignals = {
  ageYears?: number;
  requestedAmount?: number;
  durationMonths?: number;
  temporaryContractExpiryIso?: string;
  hasRenewalReceiptOnly?: boolean;
  isStudent?: boolean;
  isHousewife?: boolean;
  isTemporaryEmployee?: boolean;
  isNonEuMention?: boolean;
};

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

/**
 * Estrae segnali tipizzati dalla domanda CM (deterministico, senza LLM).
 * Non inventa policy: serve solo a orientare il pre-screening.
 */
export function extractPreScreeningSignals(
  question: string,
): PreScreeningQuestionSignals {
  const raw = question.toLowerCase();
  const normalized = normalizeText(question);
  const signals: PreScreeningQuestionSignals = {};

  const ageMatch = raw.match(/\b(\d{1,3})\s*anni\b/);
  if (ageMatch) {
    const age = Number(ageMatch[1]);
    if (age >= 1 && age <= 120) signals.ageYears = age;
  }

  const amountEuro = raw.match(
    /\b(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*€|\b(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*euro\b/,
  );
  if (amountEuro) {
    const rawAmount = amountEuro[1] ?? amountEuro[2];
    if (rawAmount) {
      signals.requestedAmount = Number(rawAmount.replace(/[.\s]/g, ""));
    }
  } else {
    const amountPlain = raw.match(
      /\b(?:finanziare|finanziamento|importo)\s+(?:di\s+|da\s+)?(\d{1,3}(?:[.\s]\d{3})+|\d+)\b/,
    );
    if (amountPlain) {
      signals.requestedAmount = Number(
        amountPlain[1]!.replace(/[.\s]/g, ""),
      );
    } else {
      // Fallback: "per 2000€" / "da 2000 euro" già coperto sopra; "per 2000"
      const perAmount = raw.match(
        /\bper\s+(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:\s*€|\s*euro)?\b/,
      );
      if (perAmount) {
        signals.requestedAmount = Number(
          perAmount[1]!.replace(/[.\s]/g, ""),
        );
      }
    }
  }

  const durationMatch = raw.match(/\b(\d{1,3})\s*(?:mesi|rate)\b/);
  if (durationMatch) {
    const months = Number(durationMatch[1]);
    if (months >= 1 && months <= 120) signals.durationMonths = months;
  }

  const isoDate = raw.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (isoDate) {
    const day = Number(isoDate[1]);
    const month = Number(isoDate[2]) - 1;
    const year = Number(isoDate[3]);
    signals.temporaryContractExpiryIso = toIsoDate(year, month, day);
  } else {
    const named = normalized.match(
      /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/,
    );
    if (named) {
      const day = Number(named[1]);
      const month = ITALIAN_MONTHS[named[2]!];
      const year = Number(named[3]);
      if (month !== undefined) {
        signals.temporaryContractExpiryIso = toIsoDate(year, month, day);
      }
    }
  }

  if (
    /\bricevuta\b/.test(normalized) &&
    (/\brinnovo\b/.test(normalized) || /\bpermesso\b/.test(normalized))
  ) {
    signals.hasRenewalReceiptOnly = true;
  }
  if (/\bsolo\s+ricevuta\b/.test(normalized) || /\bcon\s+solo\s+ricevuta\b/.test(normalized)) {
    signals.hasRenewalReceiptOnly = true;
  }

  if (/\bstudente\b/.test(normalized)) signals.isStudent = true;
  if (/\bcasalinga\b/.test(normalized)) signals.isHousewife = true;
  if (
    /\btempo\s+determinato\b/.test(normalized) ||
    /\bdeterminato\b/.test(normalized)
  ) {
    signals.isTemporaryEmployee = true;
  }
  if (
    /\bextracomunitari/.test(normalized) ||
    /\bpermesso\b/.test(normalized) ||
    /\bricevuta\b/.test(normalized)
  ) {
    signals.isNonEuMention = true;
  }

  return signals;
}

function toIsoDate(year: number, month: number, day: number): string | undefined {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

function rulesByCompany(
  rules: PreScreeningPolicyRule[],
): Map<string, PreScreeningPolicyRule[]> {
  const map = new Map<string, PreScreeningPolicyRule[]>();
  for (const rule of rules) {
    const key = rule.companyShortName ?? rule.companyName ?? rule.companyId;
    const list = map.get(key) ?? [];
    list.push(rule);
    map.set(key, list);
  }
  return map;
}

function compareAge(
  age: number,
  operator: string,
  value: number,
): boolean | null {
  switch (operator) {
    case "less_than":
      return age < value;
    case "less_than_or_equal":
      return age <= value;
    case "greater_than":
      return age > value;
    case "greater_than_or_equal":
      return age >= value;
    case "equals":
      return age === value;
    default:
      return null;
  }
}

export type CompanyPreScreeningStatus = {
  companyKey: string;
  companyId?: string;
  status: "excluded" | "verification_required" | "potentially_evaluable" | "unknown";
  reasons: string[];
};

/**
 * Stato formale per finanziaria in base a segnali domanda + policy filtrate.
 * Usato per escludere tabelle di finanziarie già not_compatible.
 */
export function resolveCompanyPreScreeningStatuses(
  context: PreScreeningContext,
  signals: PreScreeningQuestionSignals,
): CompanyPreScreeningStatus[] {
  const byCompany = rulesByCompany(context.policyRules);
  const results: CompanyPreScreeningStatus[] = [];

  for (const company of context.companies) {
    const key = company.shortName;
    const rules = byCompany.get(key) ?? byCompany.get(company.name) ?? [];
    const reasons: string[] = [];
    let status: CompanyPreScreeningStatus["status"] = "unknown";

    if (signals.ageYears !== undefined) {
      const minAge = rules.find((rule) => rule.ruleType === "minimum_age");
      const maxApp = rules.find(
        (rule) => rule.ruleType === "maximum_age_at_application",
      );
      const maxEnd = rules.find(
        (rule) => rule.ruleType === "maximum_age_at_end",
      );
      if (
        minAge?.numericValue !== undefined &&
        compareAge(
          signals.ageYears,
          minAge.operator || "greater_than_or_equal",
          minAge.numericValue,
        ) === false
      ) {
        status = "excluded";
        reasons.push(minAge.failureMessage);
      } else if (
        maxApp?.numericValue !== undefined &&
        compareAge(
          signals.ageYears,
          maxApp.operator || "less_than_or_equal",
          maxApp.numericValue,
        ) === false
      ) {
        status = "excluded";
        reasons.push(maxApp.failureMessage);
      } else if (
        maxEnd?.numericValue !== undefined &&
        signals.ageYears > maxEnd.numericValue
      ) {
        status = "excluded";
        reasons.push(maxEnd.failureMessage);
      } else if (maxEnd?.numericValue !== undefined) {
        status =
          signals.durationMonths === undefined
            ? "potentially_evaluable"
            : "potentially_evaluable";
        reasons.push(
          signals.durationMonths === undefined
            ? `Serve la durata per verificare il limite a fine piano (${maxEnd.operator} ${maxEnd.numericValue}).`
            : `Verificare età a fine piano con durata ${signals.durationMonths} mesi (limite ${maxEnd.operator} ${maxEnd.numericValue}).`,
        );
      }
    }

    if (status !== "excluded" && (signals.hasRenewalReceiptOnly || signals.isNonEuMention)) {
      const renewal = rules.find(
        (rule) => rule.ruleType === "renewal_receipt_allowed",
      );
      if (signals.hasRenewalReceiptOnly && renewal) {
        if (renewal.booleanValue === false) {
          status = "excluded";
          reasons.push(renewal.failureMessage);
        } else {
          status = "verification_required";
          reasons.push(
            renewal.verificationMessage ?? renewal.failureMessage,
          );
        }
      }
    }

    if (status !== "excluded" && (signals.isStudent || signals.isHousewife)) {
      const employmentKey = signals.isStudent ? "student" : "housewife";
      const blocked = rules.find(
        (rule) =>
          rule.ruleType === "employment_type_allowed" &&
          rule.operator === "not_in" &&
          rule.stringValues?.includes(employmentKey),
      );
      if (blocked) {
        status = "excluded";
        reasons.push(blocked.failureMessage);
      } else {
        const amountCap = rules.find(
          (rule) =>
            rule.ruleType === "maximum_amount_for_employment_types" &&
            rule.stringValues?.includes(employmentKey),
        );
        if (
          amountCap?.numericValue !== undefined &&
          signals.requestedAmount !== undefined &&
          signals.requestedAmount > amountCap.numericValue
        ) {
          status = "excluded";
          reasons.push(amountCap.failureMessage);
        } else {
          const guarantor = rules.find(
            (rule) =>
              rule.ruleType === "guarantor_required_for_employment_types" &&
              rule.stringValues?.includes("student"),
          );
          if (signals.isStudent && guarantor) {
            status = "verification_required";
            reasons.push(
              guarantor.verificationMessage ?? guarantor.failureMessage,
            );
          } else if (status === "unknown" || status === "potentially_evaluable") {
            status = "potentially_evaluable";
            if (amountCap?.numericValue !== undefined) {
              reasons.push(
                `Importo entro il limite profilo ${amountCap.numericValue} € (se noto).`,
              );
            }
          }
        }
      }
    }

    if (status !== "excluded" && signals.isTemporaryEmployee) {
      status =
        status === "verification_required"
          ? "verification_required"
          : "verification_required";
      reasons.push(
        signals.temporaryContractExpiryIso
          ? `Contratto determinato con scadenza ${signals.temporaryContractExpiryIso}: verificare che il piano termini prima.`
          : "Serve la data di scadenza del contratto determinato per verificare che il finanziamento termini prima.",
      );
    }

    results.push({
      companyKey: key,
      companyId: company.id,
      status,
      reasons,
    });
  }

  return results;
}

/**
 * Orientamento operativo per Virtual Marco.
 * Distingue ESCLUSA / DA VERIFICARE / POTENZIALMENTE VALUTABILE.
 */
export function buildPreScreeningOrientation(
  context: PreScreeningContext,
  signals: PreScreeningQuestionSignals,
  statuses?: CompanyPreScreeningStatus[],
): string[] {
  const lines: string[] = [
    "ORIENTAMENTO PRE-SCREENING (deterministico; non sostituisce il simulatore)",
    "- Non dichiarare “compatibile” o “finanziabile” se mancano durata o altri dati indispensabili alle policy a fine piano.",
    "- Usa prima le esclusioni già certe; poi indica cosa manca per concludere.",
    "- Non garantire l’approvazione della finanziaria.",
    "- Non presentare tabelle di finanziarie già ESCLUSE come soluzioni possibili.",
  ];

  if (signals.ageYears !== undefined) {
    lines.push(`Età dichiarata nella domanda: ${signals.ageYears} anni.`);
  }
  if (signals.requestedAmount !== undefined) {
    lines.push(`Importo dichiarato nella domanda: ${signals.requestedAmount} €.`);
  }
  if (signals.durationMonths !== undefined) {
    lines.push(`Durata dichiarata: ${signals.durationMonths} mesi.`);
  } else if (
    signals.ageYears !== undefined ||
    signals.isTemporaryEmployee ||
    signals.isStudent ||
    signals.isHousewife
  ) {
    lines.push(
      "Durata del piano NON indicata: può servire per restringere le tabelle e verificare limiti a fine piano.",
    );
  }

  const resolved =
    statuses ?? resolveCompanyPreScreeningStatuses(context, signals);

  const excluded = resolved.filter((item) => item.status === "excluded");
  const verification = resolved.filter(
    (item) => item.status === "verification_required",
  );
  const evaluable = resolved.filter(
    (item) => item.status === "potentially_evaluable",
  );

  if (excluded.length > 0) {
    lines.push("", "SOLUZIONI ESCLUSE DALLE POLICY:");
    for (const item of excluded) {
      lines.push(
        `- ${item.companyKey}: ESCLUSA — ${item.reasons.join(" | ") || "policy non soddisfatta"}`,
      );
    }
  }

  if (verification.length > 0) {
    lines.push("", "VERIFICHE NECESSARIE:");
    for (const item of verification) {
      lines.push(
        `- ${item.companyKey}: DA VERIFICARE — ${item.reasons.join(" | ")}`,
      );
    }
  }

  if (evaluable.length > 0) {
    lines.push("", "SOLUZIONI ANCORA VALUTABILI:");
    for (const item of evaluable) {
      lines.push(
        `- ${item.companyKey}: potenzialmente valutabile${item.reasons.length ? ` — ${item.reasons.join(" | ")}` : ""}. Nessuna promessa di approvazione.`,
      );
    }
  }

  if (
    signals.isStudent ||
    signals.isHousewife ||
    signals.isTemporaryEmployee ||
    signals.hasRenewalReceiptOnly
  ) {
    lines.push(
      "",
      "DATI MANCANTI / SUCCESSIVI:",
      "- Durata desiderata (se non indicata) per individuare le tabelle specifiche.",
      "- Per studente Compass: conferma presenza/documentazione del garante con reddito dimostrabile.",
      "- L’esito definitivo resta della finanziaria; usare il simulatore per il calcolo rata.",
    );
  }

  return lines;
}
