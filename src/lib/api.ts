interface SuccessEnvelope<T> {
  data: T;
  meta: { requestId: string };
}

interface ErrorEnvelope {
  error: { code: string; message: string; retryable: boolean };
  meta: { requestId: string };
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : "Request failed");
  }
  return payload.data;
}
