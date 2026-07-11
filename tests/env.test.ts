import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env";

describe("parseEnvironment", () => {
  it("defaults to credential-free local demo mode", () => {
    expect(parseEnvironment({})).toMatchObject({
      APP_MODE: "local",
      AUTH_MODE: "demo",
      DEMO_COMPANY_ID: "demo-salon",
      NEXT_PUBLIC_DEMO_MODE: "true",
    });
  });

  it("rejects an unsupported application mode", () => {
    expect(() => parseEnvironment({ APP_MODE: "unsupported" })).toThrow();
  });
});
