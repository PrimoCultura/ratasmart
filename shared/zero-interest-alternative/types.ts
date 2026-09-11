export const ZERO_INTEREST_ALTERNATIVE_VERSION = "1.0.0";

export const ZERO_INTEREST_ALTERNATIVE_CONFIG = {
  /** Limite tecnico interno di ricerca (non mostrare al CM come soglia operativa). */
  maxSuggestedDiscountPercent: 18,
  equivalenceToleranceEuro: 10,
  equivalenceTolerancePercent: 0.5,
} as const;

export type ZeroInterestAlternativeConfig = {
  maxSuggestedDiscountPercent: number;
  equivalenceToleranceEuro: number;
  equivalenceTolerancePercent: number;
};

export const ZERO_VS_STANDARD_AUTONOMY_WARNING =
  "Verifica che la percentuale di sconto rientri nei livelli di autonomia e nelle autorizzazioni aziendali attualmente in vigore.";

export const DOCTOR_COMPENSATION_NOTE =
  "Con lo sconto si riduce anche la base di fatturato sulla quale viene calcolato il compenso medico.";

export type ZeroInterestAlternative = {
  zeroSolutionId: string;
  standardSolutionId: string;
  zeroCompanyShortName: string;
  zeroTableCode: string;
  standardCompanyShortName: string;
  standardTableCode: string;
  durationMonths: number;
  originalAmount: number;
  discountedAmount: number;
  discountPercent: number;
  zeroRateRequestedAmount: number;
  zeroRateOpeningFeeAmount: number;
  zeroRateFinancedAmount: number;
  zeroRatePatientTotal: number;
  standardRequestedAmount: number;
  standardOpeningFeeAmount: number;
  standardFinancedAmount: number;
  standardPatientTotal: number;
  patientTotalDifferenceEuro: number;
  zeroRateInstallment: number;
  standardInstallment: number;
  installmentDifferenceEuro: number;
  zeroRateCompanyCostEuro: number;
  standardCompanyCostEuro: number;
  zeroRateNetToCompanyEuro: number;
  standardNetToCompanyEuro: number;
  discountValueEuro: number;
  /**
   * standardNet − zeroNet.
   * Positivo = standard migliore; negativo = tasso zero migliore.
   */
  netCompanyDifferenceBeforeDoctorCompensationEuro: number;
  /** Riduzione base fatturato per compenso medico (non monetizzata). */
  doctorCompensationBaseReductionEuro: number;
  /** Soglia teorica % di pareggio; assente se non applicabile. */
  doctorCompensationBreakEvenPercent?: number;
  equivalent: boolean;
  warning: string;
  doctorCompensationNote: string;
};

export type ZeroInterestAlternativeAnalysis = {
  version: string;
  enabled: boolean;
  referenceDate: number;
  originalAmount: number;
  primary?: ZeroInterestAlternative;
  alternatives: ZeroInterestAlternative[];
  messages: string[];
};

export type ZeroInterestAlternativeSnapshot = ZeroInterestAlternativeAnalysis;
