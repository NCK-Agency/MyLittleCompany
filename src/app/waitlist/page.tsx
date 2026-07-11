import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Join the waitlist | My Little Company",
  description: "Join the waitlist for My Little Company account access.",
};

export default function WaitlistPage() {
  return (
    <main className="waitlist-page">
      <section className="waitlist-panel" aria-labelledby="waitlist-title">
        <div className="waitlist-story">
          <BrandMark className="size-16" />
          <p className="page-kicker mt-10 text-[var(--butter)]">Early access</p>
          <h1 id="waitlist-title">Join the waitlist.</h1>
          <p>We’re opening My Little Company carefully so every new company gets a dependable start.</p>
          <ul>
            <li>Explain your business once.</li>
            <li>Approve what becomes company knowledge.</li>
            <li>Give employees and assistants the same trusted answer.</li>
          </ul>
        </div>
        <div className="waitlist-form-panel">
          <p className="page-kicker">Request access</p>
          <h2>Tell us where to reach you.</h2>
          <p className="waitlist-form-lede">New accounts are invite-only for now. Joining the waitlist does not create an account.</p>
          <WaitlistForm />
          <p className="waitlist-sign-in">Already have access? <Link href="/login">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
