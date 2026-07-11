import { redirect } from "next/navigation";
import { MemoryDetail } from "@/components/memory-detail";
import { isOwner } from "@/domain/authorization";
import { optionalActor } from "@/server/auth-context";

export default async function MemoryPage({ params }: { params: Promise<{ memoryId: string }> }) {
  const actor = await optionalActor();
  if (!actor || (!isOwner(actor) && !actor.grants.some((grant) => grant.permission === "READ" || grant.permission === "APPROVE"))) redirect("/no-access");
  const { memoryId } = await params;
  return <MemoryDetail memoryId={memoryId} />;
}
