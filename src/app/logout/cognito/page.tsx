import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export default function CognitoLogoutPage() {
  if (env.AUTH_MODE !== "cognito" || !env.COGNITO_DOMAIN || !env.AUTH_URL || !env.COGNITO_CLIENT_ID) {
    redirect("/");
  }
  const logout = new URL("/logout", env.COGNITO_DOMAIN);
  logout.searchParams.set("client_id", env.COGNITO_CLIENT_ID);
  logout.searchParams.set("logout_uri", new URL("/", env.AUTH_URL).toString());
  redirect(logout.toString());
}
