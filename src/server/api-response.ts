import { ZodError } from "zod";
import { AppError } from "@/domain/errors";

const knownCodes = new Set([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "STALE_WRITE",
  "NO_APPROVED_CONTEXT",
  "MODEL_OUTPUT_INVALID",
  "MODEL_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "INDEX_FAILED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CONFIGURATION_ERROR",
]);

export function ok(data: unknown, status = 200): Response {
  return Response.json(
    { data, meta: { requestId: crypto.randomUUID() } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function apiError(error: unknown): Response {
  const requestId = crypto.randomUUID();
  const validation = error instanceof ZodError;
  const rawCode = error instanceof AppError
    ? error.code
    : error instanceof Error ? error.message : "INTERNAL_ERROR";
  const code = validation ? "VALIDATION_ERROR" : knownCodes.has(rawCode) ? rawCode : "INTERNAL_ERROR";
  const status = validation || code === "VALIDATION_ERROR" ? 400 : code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "CONFLICT" || code === "STALE_WRITE" ? 409 : code === "RATE_LIMITED" ? 429 : 500;
  const message = validation || code === "VALIDATION_ERROR"
    ? "Please check the information and try again."
    : code === "UNAUTHENTICATED"
      ? "Sign in to continue."
      : code === "FORBIDDEN"
      ? "You do not have permission to do that."
      : code === "NOT_FOUND"
        ? "The requested item could not be found."
        : code === "STALE_WRITE"
          ? "This entry changed since you opened it. Refresh it before saving your edit."
          : code === "CONFLICT"
            ? "This entry cannot be changed in its current state."
        : code === "RATE_LIMITED"
          ? "Too many requests. Please wait a moment and try again."
        : code === "NO_APPROVED_CONTEXT"
          ? "No approved company rule is available yet."
        : code === "MODEL_UNAVAILABLE"
          ? "This assistant model is temporarily unavailable."
        : code === "PROVIDER_TIMEOUT"
          ? "The assistant took too long to respond. Please try again."
          : "Something went wrong. Please try again.";
  console.error(JSON.stringify({
    level: "error",
    requestId,
    code,
    retryable: error instanceof AppError ? error.retryable : status >= 500,
    providerRequestId: error instanceof AppError ? error.providerRequestId : undefined,
  }));
  return Response.json(
    { error: { code, message, retryable: error instanceof AppError ? error.retryable : status >= 500 }, meta: { requestId } },
    { status },
  );
}
