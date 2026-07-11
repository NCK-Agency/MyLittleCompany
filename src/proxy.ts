import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loginPathForMode } from "@/lib/auth-navigation";
import { env } from "@/lib/env";

export default auth((request) => {
  if (!request.auth) {
    const login = new URL(loginPathForMode(env.AUTH_MODE), request.nextUrl);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/workspace/:path*", "/chat/:path*", "/review/:path*", "/playbook/:path*", "/onboarding/:path*"],
};
