import type { ActorContext } from "@/domain/types";

export function ownerActor(): ActorContext {
  return {
    userId: "user-owner-demo",
    companyId: "demo-salon",
    roles: ["OWNER"],
    demoMode: true,
  };
}

export function employeeActor(): ActorContext {
  return {
    userId: "user-employee-demo",
    companyId: "demo-salon",
    roles: ["EMPLOYEE", "FRONT_DESK"],
    demoMode: true,
  };
}
