import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  if (!request.auth) {
    const login = new URL("/login", request.nextUrl);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/workspace/:path*", "/chat/:path*", "/review/:path*", "/playbook/:path*", "/onboarding/:path*"],
};
