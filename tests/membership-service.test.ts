import { beforeEach, describe, expect, it } from "vitest";
import { LocalCompanyRepository } from "@/adapters/local/company-repository";
import { LocalIdentityAdmin } from "@/adapters/local/identity-admin";
import { LocalMembershipRepository } from "@/adapters/local/membership-repository";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import { resetDemoState } from "@/adapters/local/demo-state";
import { MembershipService } from "@/services/membership-service";
import { ownerActor } from "@/server/actors";

function service(): MembershipService {
  return new MembershipService(
    new LocalMembershipRepository(),
    new LocalIdentityAdmin(),
    new LocalCompanyRepository(),
    new LocalMemoryRepository(),
  );
}

beforeEach(() => resetDemoState());

describe("MembershipService", () => {
  it("rejects identities without a current company membership", async () => {
    await expect(service().resolveActor("DEMO", "forged-user")).rejects.toThrow("FORBIDDEN");
  });

  it("invites a scoped member and activates them on first resolved request", async () => {
    const memberships = service();
    const invited = await memberships.invite({
      email: "new@example.com",
      displayName: "New teammate",
      roles: ["MARKETING"],
      grants: [{ permission: "SUGGEST", scope: { level: "DEPARTMENT", organizationalUnitId: "unit-marketing" } }],
    }, ownerActor());
    expect(invited.status).toBe("INVITED");
    const actor = await memberships.resolveActor("DEMO", invited.identitySubject);
    expect(actor.userId).toBe(invited.userId);
    expect((await memberships.list(ownerActor())).find((item) => item.userId === invited.userId)?.status).toBe("ACTIVE");
  });

  it("rejects duplicates and invalid department grants", async () => {
    const memberships = service();
    await expect(memberships.invite({
      email: "maya@example.com", displayName: "Duplicate", roles: ["EMPLOYEE"], grants: [],
    }, ownerActor())).rejects.toThrow("CONFLICT");
    await expect(memberships.invite({
      email: "invalid@example.com", displayName: "Invalid", roles: ["EMPLOYEE"],
      grants: [{ permission: "READ", scope: { level: "DEPARTMENT", organizationalUnitId: "other-company" } }],
    }, ownerActor())).rejects.toThrow("FORBIDDEN");
  });

  it("applies grant changes immediately and blocks disabled memberships", async () => {
    const memberships = service();
    const invited = await memberships.invite({
      email: "reviewer@example.com", displayName: "Reviewer", roles: ["OPERATIONS"], grants: [],
    }, ownerActor());
    const active = await memberships.resolveActor("DEMO", invited.identitySubject);
    expect(active.grants).toEqual([]);
    await memberships.update(invited.userId, {
      displayName: invited.displayName,
      roles: invited.roles,
      grants: [{ permission: "APPROVE", scope: { level: "DEPARTMENT", organizationalUnitId: "unit-operations" } }],
      status: "ACTIVE",
    }, ownerActor());
    expect((await memberships.resolveActor("DEMO", invited.identitySubject)).grants[0]?.permission).toBe("APPROVE");
    await memberships.update(invited.userId, {
      displayName: invited.displayName, roles: invited.roles, grants: [], status: "DISABLED",
    }, ownerActor());
    await expect(memberships.establishSession("DEMO", invited.identitySubject)).resolves.toMatchObject({ status: "DISABLED" });
    await expect(memberships.resolveActor("DEMO", invited.identitySubject)).rejects.toThrow("FORBIDDEN");
  });
});
