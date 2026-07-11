import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import { isOwner } from "@/domain/authorization";
import { optionalActor } from "@/server/auth-context";

export default async function ChatPage() {
  const actor = await optionalActor();
  if (!actor || (!isOwner(actor) && actor.grants.length === 0)) redirect("/no-access");
  return <Suspense fallback={<main className="mx-auto max-w-[90rem] p-8 font-bold text-[var(--cobalt)]">Opening Chat…</main>}><ChatWorkspace /></Suspense>;
}
