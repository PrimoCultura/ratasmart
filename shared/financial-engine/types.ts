export type OpeningFeeType = "none" | "fixed" | "percentage";

export type FinancialCalculationInput = {
  requestedAmount: number;
  durationMonths: number;
  customerTanPercent: number;
  openingFeeType: OpeningFeeType;
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  internalCostPercentAt24Months?: number;
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
  collectionFeePerInstallment: number;
  regularTotalInstallmentAmount: number;
  finalTotalInstallmentAmount: number;
  totalPrincipalRepaid: number;
  totalCustomerInterest: number;
  totalCollectionFees: number;
  totalCustomerRepayment: number;
  totalCustomerCosts: number;
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
