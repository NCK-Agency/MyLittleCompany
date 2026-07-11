import type { ActorContext } from "@/domain/types";

export function ownerActor(): ActorContext {
  return {
    userId: "user-owner-demo",
    companyId: "demo-salon",
    email: "maya@example.com",
    displayName: "Maya",
    roles: ["OWNER"],
    grants: [],
    organizationalUnitIds: ["unit-marketing", "unit-operations", "unit-front-desk"],
    demoMode: true,
  };
}

export function employeeActor(): ActorContext {
  return {
    userId: "user-employee-demo",
    companyId: "demo-salon",
    email: "lina@example.com",
    displayName: "Lina",
    roles: ["EMPLOYEE", "FRONT_DESK"],
    grants: [{ permission: "READ", scope: { level: "DEPARTMENT", organizationalUnitId: "unit-front-desk" } }],
    organizationalUnitIds: ["unit-front-desk"],
    demoMode: true,
  };
}
