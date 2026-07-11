"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">We couldn’t open this page.</h1><p className="mt-3 text-[var(--muted)]">Your company knowledge has not been changed.</p><button className="primary-button mt-6" onClick={reset} type="button">Try again</button></main>; }
