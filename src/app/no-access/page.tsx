import { SignOutButton } from "@/components/sign-out-button";

export default function NoAccessPage() {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 text-center">
      <div>
        <p className="page-kicker">Access unavailable</p>
        <h1 className="page-title mt-3">Ask your owner for access.</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">Your sign-in worked, but you do not currently have an active company membership.</p>
        <div className="mt-7 flex justify-center"><SignOutButton className="primary-button" /></div>
      </div>
    </main>
  );
}
