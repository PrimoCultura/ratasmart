export type OpeningFeeType = "none" | "fixed" | "percentage";

export type InstallmentFeeType =
  | "none"
  | "fixed"
  | "percentage_of_requested_amount";

export type InternalCostBase = "requested_amount" | "financed_amount";

export type FinancialCalculationInput = {
  requestedAmount: number;
  durationMonths: number;
  customerTanPercent: number;
  openingFeeType: OpeningFeeType;
  openingFeeValue: number;
  /**
   * Legacy / risolto: spesa fissa in euro per rata.
   * Se installmentFeeType è assente, viene interpretata come fee fissa.
   */
  collectionFeePerInstallment?: number;
  installmentFeeType?: InstallmentFeeType;
  installmentFeeValue?: number;
  /**
   * Costo aziendale esatto già risolto per la durata.
   * Se presente, ha priorità sul fallback proporzionale a 24 mesi.
   */
  internalCostPercentApplied?: number;
  /** @deprecated Preferire internalCostPercentApplied per tabelle reali. */
  internalCostPercentAt24Months?: number;
  /** Default legacy: financed_amount. */
  internalCostBase?: InternalCostBase;
  firstInstallmentDelayDays: number;
};

export type AmortizationRow = {
  installmentNumber: number;
  dueOffsetMonths: number;
  openingBalance: number;
  interestAmount: number;
  principalAmount: number;
  baseInstallmentAmount: number;
  collectionFeeAmount: number;
  totalInstallmentAmount: number;
  closingBalance: number;
};

export type TaegErrorCode =
  | "NO_VALID_ROOT"
  | "INVALID_CASH_FLOWS"
  | "MAX_ITERATIONS_REACHED";

export type TaegCalculationResult =
  | {
      success: true;
      monthlyRate: number;
      annualEffectiveRate: number;
      taegPercent: number;
      iterations: number;
    }
  | {
      success: false;
      monthlyRate: null;
      annualEffectiveRate: null;
      taegPercent: null;
      iterations: number;
      errorCode: TaegErrorCode;
      errorMessage: string;
    };

export type FinancialCalculationResult = {
  requestedAmount: number;
  openingFeeAmount: number;
  financedAmount: number;
  durationMonths: number;
  firstInstallmentDelayDays: number;
  customerTanPercent: number;
  monthlyNominalRate: number;
  theoreticalBaseInstallmentAmount: number;
  regularBaseInstallmentAmount: number;
  installmentFeeType: InstallmentFeeType;
  installmentFeeValue: number;
  /** Fee in euro effettivamente applicata a ogni rata. */
  collectionFeePerInstallment: number;
  regularTotalInstallmentAmount: number;
  finalTotalInstallmentAmount: number;
  totalPrincipalRepaid: number;
  totalCustomerInterest: number;
  totalCollectionFees: number;
  totalCustomerRepayment: number;
  totalCustomerCosts: number;
  internalCostBase: InternalCostBase;
  internalCostPercentAt24Months: number;
  internalCostPercentApplied: number;
  internalCostAmount: number;
  netAmountPaidToCompany: number;
  estimatedTaeg: TaegCalculationResult;
  amortizationSchedule: AmortizationRow[];
  warnings: string[];
};

export type AllowedDurationsInput = {
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
};

export type CashFlow = {
  periodMonths: number;
  amount: number;
};
