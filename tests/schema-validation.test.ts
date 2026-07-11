import { describe, expect, it } from "vitest";
import { candidateSchema, sopDraftSchema } from "@/domain/schemas";

describe("external structured output schemas", () => {
  it("rejects incomplete memory candidates", () => {
    expect(() => candidateSchema.parse({ title: "Missing fields" })).toThrow();
  });

  it("rejects SOPs without observable steps", () => {
    expect(() => sopDraftSchema.parse({ title: "No steps" })).toThrow();
  });
});
