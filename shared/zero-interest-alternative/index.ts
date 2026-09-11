export {
  ZERO_INTEREST_ALTERNATIVE_CONFIG,
  ZERO_INTEREST_ALTERNATIVE_VERSION,
  ZERO_VS_STANDARD_AUTONOMY_WARNING,
  DOCTOR_COMPENSATION_NOTE,
  NO_ZERO_INTEREST_ON_DURATION_MESSAGE,
} from "./types.ts";
export type {
  ZeroInterestAlternative,
  ZeroInterestAlternativeAnalysis,
  ZeroInterestAlternativeConfig,
  ZeroInterestAlternativeSnapshot,
  ZeroInterestReferenceType,
} from "./types.ts";

export {
  findEquivalentDiscountPercent,
  calculateStandardAtAmount,
  isPatientTotalEquivalent,
  resolveEquivalenceTolerance,
} from "./find-equivalent-discount.ts";
export type { StandardTableEconomics } from "./find-equivalent-discount.ts";

export { analyzeZeroInterestAlternative, rankZeroInterestReferences } from "./compare-zero-vs-standard.ts";
export {
  summarizeEconomicImpact,
  computeNetCompanyDifferenceBeforeDoctorCompensation,
  computeDoctorCompensationBaseReduction,
  computeDoctorCompensationBreakEvenPercent,
} from "./economic-impact.ts";
export type { PcgEconomicImpact } from "./economic-impact.ts";

export {
  getReferenceShortLabel,
  getReferenceSectionTitle,
  getAnalysisCardTitle,
  getAnalysisCardSubtitle,
  getAlertTitle,
  getAlertSubtitle,
  getNetToCompanyReferenceLabel,
  formatPatientTotalDifferenceCopy,
  getPrimaryProductHeadline,
} from "./labels.ts";
