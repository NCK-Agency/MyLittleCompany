import { describe, expect, it } from "vitest";
import {
  loginErrorMessage,
  loginPathForMode,
  safeReturnTo,
} from "@/lib/auth-navigation";

describe("authentication navigation", () => {
  it("keeps same-origin application return paths", () => {
    expect(safeReturnTo("/chat?assistant=MARKETING#latest")).toBe("/chat?assistant=MARKETING#latest");
    expect(safeReturnTo("/oauth/authorize?client_id=test")).toBe("/oauth/authorize?client_id=test");
  });

  it("rejects external or ambiguous return paths", () => {
    expect(safeReturnTo(undefined)).toBe("/workspace");
    expect(safeReturnTo("https://attacker.example/path")).toBe("/workspace");
    expect(safeReturnTo("//attacker.example/path")).toBe("/workspace");
    expect(safeReturnTo("/\\attacker.example/path")).toBe("/workspace");
  });

  it("separates demo and Cognito entry points", () => {
    expect(loginPathForMode("demo")).toBe("/login-demo");
    expect(loginPathForMode("cognito")).toBe("/login");
  });

  it("does not expose provider error details", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage("AccessDenied")).toMatch(/does not have active company access/i);
    expect(loginErrorMessage("Configuration")).toMatch(/temporarily unavailable/i);
    expect(loginErrorMessage("InvalidEmail")).toMatch(/valid email address/i);
    expect(loginErrorMessage("UnexpectedProviderDetail")).toBe(
      "We could not complete sign-in. Please try again or ask your company owner for help.",
    );
  });
});
