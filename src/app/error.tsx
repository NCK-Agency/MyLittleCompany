"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8"><p className="page-kicker">Something went wrong</p><h1 className="page-title mt-3">We couldn’t open this page.</h1><p className="mt-4 text-lg text-[var(--muted)]">Your company knowledge has not been changed.</p><button className="primary-button mt-7" onClick={reset} type="button">Try again</button></main>;
}
