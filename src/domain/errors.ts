export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STALE_WRITE"
  | "NO_APPROVED_CONTEXT"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INDEX_FAILED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFIGURATION_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly retryable = false,
    options?: { cause?: unknown; providerRequestId?: string },
  ) {
    super(code, { cause: options?.cause });
    this.name = "AppError";
    this.providerRequestId = options?.providerRequestId;
  }

  readonly providerRequestId?: string;
}

export function appError(code: AppErrorCode, retryable = false, cause?: unknown): AppError {
  return new AppError(code, retryable, { cause });
}
