export type FinancialEngineErrorCode =
  | "INVALID_REQUESTED_AMOUNT"
  | "INVALID_DURATION"
  | "INVALID_TAN"
  | "INVALID_OPENING_FEE"
  | "INVALID_COLLECTION_FEE"
  | "INVALID_INTERNAL_COST"
  | "INVALID_FIRST_INSTALLMENT_DELAY"
  | "AMORTIZATION_DID_NOT_CLOSE"
  | "INVALID_NUMERIC_VALUE";

export class FinancialEngineError extends Error {
  readonly code: FinancialEngineErrorCode;

  constructor(code: FinancialEngineErrorCode, message: string) {
    super(message);
    this.name = "FinancialEngineError";
    this.code = code;
  }
}
