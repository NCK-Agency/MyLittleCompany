import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { loginErrorMessage, safeReturnTo } from "@/lib/auth-navigation";
import { env } from "@/lib/env";
import { optionalActor } from "@/server/auth-context";

export const metadata: Metadata = {
  title: "Sign in | My Little Company",
  description: "Sign in securely to your My Little Company account.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}

const loginSchema = z.object({ email: z.email() });

export default async function LoginPage({ searchParams }: Props) {
  if (await optionalActor()) redirect("/workspace");
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo);
  const errorMessage = loginErrorMessage(query.error);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl place-items-center px-4 py-12">
      <section className="grid w-full overflow-hidden border-2 border-[var(--cobalt-deep)] bg-white lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-[var(--cobalt)] p-8 text-white sm:p-12">
          <BrandMark className="size-16" />
          <p className="page-kicker mt-10 text-[var(--butter)]">Invite-only company access</p>
          <h1 className="page-title mt-4">Welcome back.</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-white/75">
            Sign in to work with the knowledge your company has approved for you.
          </p>
          <div className="mt-10 border-l-2 border-[var(--butter)] pl-4 text-sm leading-6 text-white/70">
            Company permissions are checked again on every request, so your access always reflects the owner&apos;s latest decision.
          </div>
        </div>
        <div className="p-8 sm:p-12">
          <p className="metadata text-xs font-black text-[var(--cobalt)]">Company account</p>
          <h2 className="mt-2 text-3xl font-black uppercase">Sign in securely</h2>
          {errorMessage && (
            <p className="mt-5 border-l-4 border-[var(--coral)] bg-[var(--butter-soft)] p-4 text-sm font-bold" role="alert">
              {errorMessage}
            </p>
          )}
          <form className="mt-8" action={async (formData) => {
            "use server";
            const parsed = loginSchema.safeParse({ email: formData.get("email") });
            if (!parsed.success) {
              redirect(`/login?returnTo=${encodeURIComponent(returnTo)}&error=InvalidEmail`);
            }
            if (env.AUTH_MODE !== "cognito") {
              redirect(`/login?returnTo=${encodeURIComponent(returnTo)}&error=Configuration`);
            }
            await signIn("cognito", { redirectTo: returnTo }, { login_hint: parsed.data.email });
          }}>
            <label className="field-label" htmlFor="login-email">Email address</label>
            <input
              autoComplete="email"
              className="text-input mt-2"
              id="login-email"
              name="email"
              placeholder="you@company.com"
              required
              type="email"
            />
            <button className="primary-button mt-5 w-full" type="submit">
              Continue <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <p className="text-sm text-[var(--muted)]">Do not have an invitation yet?</p>
            <Link className="mt-2 inline-flex min-h-11 items-center font-bold text-[var(--cobalt)] underline" href="/waitlist">
              Join the waitlist
            </Link>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Public registration is not open yet.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
