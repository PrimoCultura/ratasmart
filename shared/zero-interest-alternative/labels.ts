import type {
  ZeroInterestAlternative,
  ZeroInterestReferenceType,
} from "./types.ts";

export function getReferenceShortLabel(
  referenceType: ZeroInterestReferenceType,
): string {
  return referenceType === "zero_interest" ? "Tasso zero" : "Tasso agevolato";
}

export function getReferenceSectionTitle(
  referenceType: ZeroInterestReferenceType,
): string {
  return referenceType === "zero_interest"
    ? "Soluzione tasso zero di riferimento"
    : "Soluzione agevolata di riferimento";
}

export function getAnalysisCardTitle(
  referenceType: ZeroInterestReferenceType,
): string {
  return referenceType === "zero_interest"
    ? "Alternativa al tasso zero"
    : "Alternativa alla soluzione agevolata";
}

export function getAnalysisCardSubtitle(
  referenceType: ZeroInterestReferenceType,
): string {
  return referenceType === "zero_interest"
    ? "RataSmart ha confrontato il tasso zero con una soluzione standard applicando uno sconto al piano di cura."
    : "RataSmart ha confrontato la soluzione agevolata con una soluzione standard applicando uno sconto al piano di cura.";
}

export function getAlertTitle(referenceType: ZeroInterestReferenceType): string {
  return referenceType === "zero_interest"
    ? "Richiesta tasso zero"
    : "Soluzione agevolata disponibile";
}

export function getAlertSubtitle(
  referenceType: ZeroInterestReferenceType,
): string {
  return referenceType === "zero_interest"
    ? "Alternativa commerciale disponibile"
    : "È stata trovata un’alternativa standard con sconto equivalente.";
}

export function getNetToCompanyReferenceLabel(
  referenceType: ZeroInterestReferenceType,
): string {
  return referenceType === "zero_interest"
    ? "Netto società - tasso zero"
    : "Netto società - tasso agevolato";
}

/**
 * Differenza totale paziente: standard − riferimento.
 * Negativo = paziente paga meno con standard+sconto.
 */
export function formatPatientTotalDifferenceCopy(
  differenceEuro: number,
): {
  text: string;
  practicallyEquivalent: boolean;
  absoluteEuro: number;
} {
  const absoluteEuro = Math.round(Math.abs(differenceEuro) * 100) / 100;
  const practicallyEquivalent = absoluteEuro <= 0.5;
  const amount = `€${absoluteEuro.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  if (absoluteEuro === 0) {
    return {
      text: `${amount} — identico`,
      practicallyEquivalent: true,
      absoluteEuro,
    };
  }

  if (differenceEuro < 0) {
    return {
      text: `${amount} in meno`,
      practicallyEquivalent,
      absoluteEuro,
    };
  }

  return {
    text: `${amount} in più`,
    practicallyEquivalent,
    absoluteEuro,
  };
}

export function getPrimaryProductHeadline(
  alternative: Pick<
    ZeroInterestAlternative,
    "standardCompanyShortName" | "standardTableCode"
  >,
): string {
  return `${alternative.standardCompanyShortName} ${alternative.standardTableCode}`;
}
