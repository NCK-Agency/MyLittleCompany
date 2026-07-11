import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalMembershipRepository } from "@/adapters/local/membership-repository";
import { signIn } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { safeReturnTo } from "@/lib/auth-navigation";
import { env } from "@/lib/env";
import { optionalActor } from "@/server/auth-context";

export const metadata: Metadata = {
  title: "Demo access | My Little Company",
  description: "Choose a seeded account for the local My Little Company demo.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}

export default async function DemoLoginPage({ searchParams }: Props) {
  if (await optionalActor()) redirect("/workspace");
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo);
  const demoAccounts = env.AUTH_MODE === "demo"
    ? (await new LocalMembershipRepository().listMemberships(env.DEMO_COMPANY_ID))
      .filter((membership) => membership.status !== "DISABLED")
    : [];

  return (
    <main className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl place-items-center px-4 py-12">
      <section className="grid w-full overflow-hidden border-2 border-[var(--cobalt-deep)] bg-white lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-[var(--cobalt)] p-8 text-white sm:p-12">
          <BrandMark className="size-16" />
          <p className="page-kicker mt-10 text-[var(--butter)]">Local product demo</p>
          <h1 className="page-title mt-4">Try every point of view.</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-white/75">
            Use a seeded company account to see how access changes for an owner,
            contributor, approver, or read-only employee.
          </p>
        </div>
        <div className="p-8 sm:p-12">
          <p className="metadata text-xs font-black text-[var(--cobalt)]">Demo access</p>
          <h2 className="mt-2 text-3xl font-black uppercase">Choose a demo account</h2>
          {env.AUTH_MODE === "demo" ? (
            <>
              <div className="mt-6 border-l-4 border-[var(--butter)] bg-[var(--butter-soft)] p-4">
                <p className="font-bold">No password is required.</p>
                <p className="mt-1 text-sm text-[var(--muted)]">These accounts contain deterministic sample data only.</p>
              </div>
              {query.error && (
                <p className="mt-4 border-l-4 border-[var(--coral)] bg-[var(--butter-soft)] p-3 text-sm font-bold">
                  That demo account is not available. Choose another account or reset the demo.
                </p>
              )}
              <div className="mt-6 grid gap-3">
                {demoAccounts.map((membership) => (
                  <form action={async () => {
                    "use server";
                    await signIn("demo", { userId: membership.identitySubject, redirectTo: returnTo });
                  }} key={membership.userId}>
                    <button className="flex min-h-16 w-full items-center justify-between border border-[var(--border-strong)] px-4 text-left hover:bg-[var(--cobalt-soft)]" type="submit">
                      <span>
                        <strong className="block">{membership.displayName}</strong>
                        <small className="text-[var(--muted)]">{membership.email}</small>
                      </span>
                      <span className="metadata text-xs font-bold">
                        {membership.roles.includes("OWNER") ? "OWNER" : membership.roles.join(" · ")}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-8 border border-[var(--border-strong)] p-5">
              <h3 className="text-lg font-black">Demo access is disabled here.</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">This environment uses your company&apos;s secure sign-in instead.</p>
              <Link className="primary-button mt-5 w-full" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
                Go to secure sign in
              </Link>
            </div>
          )}
          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <Link className="inline-flex min-h-11 items-center font-bold text-[var(--cobalt)] underline" href="/login">
              Company account sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
