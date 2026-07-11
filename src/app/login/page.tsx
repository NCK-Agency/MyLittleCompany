import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { LocalMembershipRepository } from "@/adapters/local/membership-repository";
import { BrandMark } from "@/components/brand-mark";
import { env } from "@/lib/env";
import { optionalActor } from "@/server/auth-context";

interface Props { searchParams: Promise<{ returnTo?: string; error?: string }> }

function safeReturnTo(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/workspace";
}

export default async function LoginPage({ searchParams }: Props) {
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
          <p className="page-kicker mt-10 text-[var(--butter)]">Secure company access</p>
          <h1 className="page-title mt-4">Welcome back.</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-white/75">Sign in to work with the knowledge your company has approved for you.</p>
        </div>
        <div className="p-8 sm:p-12">
          <h2 className="text-3xl font-black uppercase">Choose your account</h2>
          {query.error && <p className="mt-4 border-l-4 border-[var(--coral)] bg-[var(--butter-soft)] p-3 text-sm font-bold">This identity does not have company access. Ask the owner to invite or restore you.</p>}
          {env.AUTH_MODE === "cognito" ? (
            <form className="mt-8" action={async () => {
              "use server";
              await signIn("cognito", { redirectTo: returnTo });
            }}>
              <button className="primary-button w-full" type="submit">Continue with Cognito</button>
              <p className="mt-4 text-sm text-[var(--muted)]">Password changes and recovery are handled securely by Amazon Cognito.</p>
            </form>
          ) : (
            <div className="mt-8 grid gap-3">
              {demoAccounts.map((membership) => (
                <form action={async () => {
                  "use server";
                  await signIn("demo", { userId: membership.identitySubject, redirectTo: returnTo });
                }} key={membership.userId}>
                  <button className="flex min-h-16 w-full items-center justify-between border border-[var(--border-strong)] px-4 text-left hover:bg-[var(--cobalt-soft)]" type="submit">
                    <span><strong className="block">{membership.displayName}</strong><small className="text-[var(--muted)]">{membership.email}</small></span>
                    <span className="metadata text-xs font-bold">{membership.roles.includes("OWNER") ? "OWNER" : membership.roles.join(" · ")}</span>
                  </button>
                </form>
              ))}
              <p className="mt-3 text-sm text-[var(--muted)]">Demo mode uses seeded accounts. No password is required.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
