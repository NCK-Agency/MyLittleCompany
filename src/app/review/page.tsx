import { redirect } from "next/navigation";
import { ReviewInbox } from "@/components/review-inbox";
import { isOwner } from "@/domain/authorization";
import { optionalActor } from "@/server/auth-context";

export default async function ReviewPage() {
  const actor = await optionalActor();
  if (!actor || (!isOwner(actor) && !actor.grants.some((grant) => grant.permission === "APPROVE"))) redirect("/no-access");
  return <ReviewInbox />;
}
