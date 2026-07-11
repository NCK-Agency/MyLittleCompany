import { redirect } from "next/navigation";
import { HomeDashboard } from "@/components/home-dashboard";
import { optionalActor } from "@/server/auth-context";

export default async function WorkspacePage() {
  if (!await optionalActor()) redirect("/no-access");
  return <HomeDashboard />;
}
