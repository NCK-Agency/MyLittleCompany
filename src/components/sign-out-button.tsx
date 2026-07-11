"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className = "quiet-button" }: { className?: string }) {
  return (
    <button className={className} onClick={() => void signOut({ callbackUrl: "/logout/cognito" })} type="button">Sign out</button>
  );
}
