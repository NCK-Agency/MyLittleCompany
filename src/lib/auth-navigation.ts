export type AuthMode = "demo" | "cognito";

const DEFAULT_RETURN_TO = "/workspace";

export function safeReturnTo(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_RETURN_TO;
  }

  try {
    const base = new URL("https://auth.my-little-company.local");
    const target = new URL(value, base);
    if (target.origin !== base.origin) return DEFAULT_RETURN_TO;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

export function loginPathForMode(mode: AuthMode): "/login" | "/login-demo" {
  return mode === "cognito" ? "/login" : "/login-demo";
}

export function loginErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "AccessDenied") {
    return "Your sign-in worked, but this account does not have active company access. Ask the owner to invite or restore you.";
  }
  if (error === "Configuration") {
    return "Secure sign-in is temporarily unavailable. Please try again later.";
  }
  if (error === "InvalidEmail") {
    return "Enter a valid email address to continue.";
  }
  return "We could not complete sign-in. Please try again or ask your company owner for help.";
}
