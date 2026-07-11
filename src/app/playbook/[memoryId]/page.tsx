import { MemoryDetail } from "@/components/memory-detail";

export default async function MemoryPage({ params }: { params: Promise<{ memoryId: string }> }) {
  const { memoryId } = await params;
  return <MemoryDetail memoryId={memoryId} />;
}
