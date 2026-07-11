import { redirect } from "next/navigation";
import { isOwner } from "@/domain/authorization";
import { PeopleAccess } from "@/components/people-access";
import { optionalActor } from "@/server/auth-context";

export default async function AccessPage() {
  const actor = await optionalActor();
  if (!actor || !isOwner(actor)) redirect("/no-access");
  return <PeopleAccess />;
}
