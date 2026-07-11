interface SuccessEnvelope<T> {
  data: T;
  meta: { requestId: string };
}

interface ErrorEnvelope {
  error: { code: string; message: string; retryable: boolean };
  meta: { requestId: string };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly requestId: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  if (!response.ok || "error" in payload) {
    if ("error" in payload) {
      throw new ApiRequestError(
        payload.error.message,
        payload.error.code,
        payload.error.retryable,
        payload.meta.requestId,
      );
    }
    throw new Error("Request failed");
  }
  return payload.data;
}
