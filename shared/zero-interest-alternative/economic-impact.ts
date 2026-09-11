import type { ZeroInterestAlternative } from "./types.ts";

export type PcgEconomicImpact = {
  originalInvoiceAmount: number;
  discountedInvoiceAmount: number;
  discountValueEuro: number;
  zeroRateCompanyCostEuro: number;
  standardCompanyCostEuro: number;
  zeroRateNetToCompanyEuro: number;
  standardNetToCompanyEuro: number;
  /** standardNet − zeroNet: positivo = standard migliore; negativo = zero migliore. */
  netCompanyDifferenceBeforeDoctorCompensationEuro: number;
  /** Riduzione base fatturato per compenso medico (non è ancora un risparmio). */
  doctorCompensationBaseReductionEuro: number;
  /**
   * Soglia teorica (%) oltre la quale la riduzione base compenserebbe
   * un netto standard inferiore. Assente se non applicabile.
   */
  doctorCompensationBreakEvenPercent?: number;
  zeroRatePatientTotal: number;
  standardPatientTotal: number;
  doctorCompensationNote: string;
};

function roundMoney2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Differenza netto società prima del compenso medico.
 * Positivo = standard migliore; negativo = tasso zero migliore.
 */
export function computeNetCompanyDifferenceBeforeDoctorCompensation(input: {
  standardNetToCompanyEuro: number;
  zeroRateNetToCompanyEuro: number;
}): number {
  return roundMoney2(
    input.standardNetToCompanyEuro - input.zeroRateNetToCompanyEuro,
  );
}

/**
 * Riduzione della base di fatturato su cui si calcola il compenso medico.
 * Non è un risparmio monetizzato.
 */
export function computeDoctorCompensationBaseReduction(input: {
  originalAmount: number;
  discountedAmount: number;
}): number {
  return roundMoney2(input.originalAmount - input.discountedAmount);
}

/**
 * Break-even informativo: percentuale teorica di remunerazione sul fatturato
 * oltre la quale la riduzione base compenserebbe un netto standard inferiore.
 * Undefined se non c’è perdita finanziaria da compensare o base reduction = 0.
 */
export function computeDoctorCompensationBreakEvenPercent(input: {
  netCompanyDifferenceBeforeDoctorCompensationEuro: number;
  doctorCompensationBaseReductionEuro: number;
}): number | undefined {
  const { netCompanyDifferenceBeforeDoctorCompensationEuro: delta } = input;
  const base = input.doctorCompensationBaseReductionEuro;
  if (!(base > 0) || !(delta < 0)) {
    return undefined;
  }
  return roundPercent2((Math.abs(delta) / base) * 100);
}

/**
 * Impatto PCG V1: numeri derivati dal financial-engine, senza inventare
 * remunerazione medico né dichiarare un vantaggio netto complessivo.
 */
export function summarizeEconomicImpact(
  alternative: ZeroInterestAlternative,
): PcgEconomicImpact {
  const netCompanyDifferenceBeforeDoctorCompensationEuro =
    alternative.netCompanyDifferenceBeforeDoctorCompensationEuro ??
    computeNetCompanyDifferenceBeforeDoctorCompensation({
      standardNetToCompanyEuro: alternative.standardNetToCompanyEuro,
      zeroRateNetToCompanyEuro: alternative.zeroRateNetToCompanyEuro,
    });
  const doctorCompensationBaseReductionEuro =
    alternative.doctorCompensationBaseReductionEuro ??
    computeDoctorCompensationBaseReduction({
      originalAmount: alternative.originalAmount,
      discountedAmount: alternative.discountedAmount,
    });
  const doctorCompensationBreakEvenPercent =
    alternative.doctorCompensationBreakEvenPercent ??
    computeDoctorCompensationBreakEvenPercent({
      netCompanyDifferenceBeforeDoctorCompensationEuro,
      doctorCompensationBaseReductionEuro,
    });

  return {
    originalInvoiceAmount: alternative.originalAmount,
    discountedInvoiceAmount: alternative.discountedAmount,
    discountValueEuro: alternative.discountValueEuro,
    zeroRateCompanyCostEuro: alternative.zeroRateCompanyCostEuro,
    standardCompanyCostEuro: alternative.standardCompanyCostEuro,
    zeroRateNetToCompanyEuro: alternative.zeroRateNetToCompanyEuro,
    standardNetToCompanyEuro: alternative.standardNetToCompanyEuro,
    netCompanyDifferenceBeforeDoctorCompensationEuro,
    doctorCompensationBaseReductionEuro,
    doctorCompensationBreakEvenPercent,
    zeroRatePatientTotal: alternative.zeroRatePatientTotal,
    standardPatientTotal: alternative.standardPatientTotal,
    doctorCompensationNote: alternative.doctorCompensationNote,
  };
}
