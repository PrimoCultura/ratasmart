export type PolicyEngineErrorCode =
  | "INVALID_PATIENT_PROFILE"
  | "INVALID_DURATION"
  | "INVALID_AMOUNT"
  | "INVALID_DELAY"
  | "UNSUPPORTED_RULE_OPERATOR";

export class PolicyEngineError extends Error {
  readonly code: PolicyEngineErrorCode;

  constructor(code: PolicyEngineErrorCode, message: string) {
    super(message);
    this.name = "PolicyEngineError";
    this.code = code;
  }
}
