import { Suspense } from "react";
import { ChatWorkspace } from "@/components/chat-workspace";

export default function ChatPage() {
  return <Suspense fallback={<main className="p-8">Opening Chat…</main>}><ChatWorkspace /></Suspense>;
}
