import { describe, expect, it, vi } from "vitest";
import { UserNotFoundException } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoIdentityAdmin } from "@/adapters/aws/cognito-identity-admin";

describe("CognitoIdentityAdmin", () => {
  it("reuses an existing Cognito identity for invitation retries", async () => {
    const send = vi.fn().mockResolvedValue({
      UserAttributes: [{ Name: "sub", Value: "subject-existing" }],
    });
    const admin = new CognitoIdentityAdmin({ send } as never, "pool-1");
    await expect(admin.invite({ email: "Person@Example.com", displayName: "Person" })).resolves.toEqual({
      provider: "COGNITO",
      subject: "subject-existing",
      email: "person@example.com",
    });
    expect(send).toHaveBeenCalledOnce();
  });

  it("creates a Cognito user when the email is not already present", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new UserNotFoundException({ $metadata: {}, message: "missing" }))
      .mockResolvedValueOnce({ User: { Attributes: [{ Name: "sub", Value: "subject-new" }] } });
    const admin = new CognitoIdentityAdmin({ send } as never, "pool-1");
    await expect(admin.invite({ email: "new@example.com", displayName: "New person" })).resolves.toMatchObject({
      provider: "COGNITO",
      subject: "subject-new",
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not hide Cognito provider failures", async () => {
    const send = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const admin = new CognitoIdentityAdmin({ send } as never, "pool-1");
    await expect(admin.invite({ email: "new@example.com", displayName: "New person" }))
      .rejects.toThrow("provider unavailable");
  });
});
