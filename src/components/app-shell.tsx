import Link from "next/link";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/review", label: "Review" },
  { href: "/playbook", label: "Playbook" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgb(247_244_238/92%)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link className="group" href="/">
            <span className="block text-sm font-bold tracking-[0.13em] text-[var(--accent)] uppercase">MLC</span>
            <span className="block text-xs text-[var(--muted)] group-hover:text-[var(--foreground)]">My Little Company</span>
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
            {navigation.map((item) => (
              <Link className="rounded-full px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[#efe7dc] hover:text-[var(--foreground)] sm:px-4" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="hidden rounded-full bg-[#eee4d8] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] sm:block">Demo company</span>
        </div>
      </header>
      {children}
    </div>
  );
}
