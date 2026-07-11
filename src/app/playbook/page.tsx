import { redirect } from "next/navigation";
import { PlaybookList } from "@/components/playbook-list";
import { isOwner } from "@/domain/authorization";
import { optionalActor } from "@/server/auth-context";

export default async function PlaybookPage() {
  const actor = await optionalActor();
  if (!actor || (!isOwner(actor) && !actor.grants.some((grant) => grant.permission === "READ" || grant.permission === "APPROVE"))) redirect("/no-access");
  return <PlaybookList />;
}
