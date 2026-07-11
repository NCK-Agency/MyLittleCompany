import { OAuthProtocolError } from "@/oauth/oauth-service";

export function oauthErrorResponse(error: unknown): Response {
  if (error instanceof OAuthProtocolError) {
    return Response.json(
      { error: error.code, error_description: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { error: "invalid_request", error_description: "The OAuth request could not be completed." },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export function noStoreJson(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(value, { ...init, headers });
}
