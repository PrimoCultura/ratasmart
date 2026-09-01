export class AiProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

export function toUserFacingError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof AiProviderError) {
    return {
      code: error.code,
      message: sanitizeErrorMessage(error.message),
    };
  }
  if (error instanceof Error) {
    return {
      code: "unknown_error",
      message: sanitizeErrorMessage(error.message),
    };
  }
  return { code: "unknown_error", message: "Errore sconosciuto." };
}
