import { ZodError } from "zod";

const knownCodes = new Set([
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "STALE_WRITE",
  "NO_APPROVED_CONTEXT",
]);

export function ok(data: unknown, status = 200): Response {
  return Response.json(
    { data, meta: { requestId: crypto.randomUUID() } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function apiError(error: unknown): Response {
  const validation = error instanceof ZodError;
  const rawCode = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const code = validation ? "VALIDATION_ERROR" : knownCodes.has(rawCode) ? rawCode : "INTERNAL_ERROR";
  const status = validation ? 400 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "CONFLICT" || code === "STALE_WRITE" ? 409 : 500;
  const message = validation
    ? "Please check the information and try again."
    : code === "FORBIDDEN"
      ? "You do not have permission to do that."
      : code === "NOT_FOUND"
        ? "The requested item could not be found."
        : code === "NO_APPROVED_CONTEXT"
          ? "No approved company rule is available yet."
          : "Something went wrong. Please try again.";
  return Response.json(
    { error: { code, message, retryable: status >= 500 }, meta: { requestId: crypto.randomUUID() } },
    { status },
  );
}
