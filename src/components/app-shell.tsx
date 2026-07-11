"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import type { ActorContext } from "@/domain/types";
import { isOwner } from "@/domain/authorization";
import { ViewerProvider } from "./viewer-context";
import { SignOutButton } from "./sign-out-button";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/review", label: "Review" },
  { href: "/playbook", label: "Playbook" },
];

export function AppShell({ children, viewer }: { children: React.ReactNode; viewer: ActorContext | null }) {
  const pathname = usePathname();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  const owner = Boolean(viewer && isOwner(viewer));
  const canUseChat = owner || Boolean(viewer?.grants.some((grant) =>
    grant.permission === "READ" || grant.permission === "SUGGEST" || grant.permission === "APPROVE"));
  const canReview = owner || Boolean(viewer?.grants.some((grant) => grant.permission === "APPROVE"));
  const canRead = owner || Boolean(viewer?.grants.some((grant) =>
    grant.permission === "READ" || grant.permission === "APPROVE"));
  const visibleNavigation = navigation.filter((item) => item.href === "/"
    || (item.href === "/chat" && canUseChat)
    || (item.href === "/review" && canReview)
    || (item.href === "/playbook" && canRead));

  if (pathname === "/chat") return <ViewerProvider viewer={viewer}>{children}</ViewerProvider>;

  return (
    <ViewerProvider viewer={viewer}><div className="min-h-screen">
      <header className="app-header">
        <div className="mx-auto flex max-w-[90rem] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link className="brand-lockup" href="/">
            <BrandMark className="size-10 shrink-0" />
            <span className="brand-wordmark">
              <span>My Little</span>
              <span>Company</span>
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="primary-navigation">
            {visibleNavigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className="navigation-link"
                  data-active={active}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {viewer ? (
            <div className="flex items-center gap-2">
              <Link className="demo-company-badge" href="/workspace">
                <span aria-hidden="true" className="status-dot" />
                {viewer.displayName}
              </Link>
              <SignOutButton className="quiet-button whitespace-nowrap" />
            </div>
          ) : (
            <div className="public-access-actions">
              <Link className="public-sign-in" href="/login">Sign in</Link>
              <Link className="public-waitlist-link" href="/waitlist">Join the waitlist</Link>
            </div>
          )}
        </div>
      </header>
      {demoMode ? <span className="demo-mode-label">Demo mode</span> : null}
      {children}
    </div></ViewerProvider>
  );
}
