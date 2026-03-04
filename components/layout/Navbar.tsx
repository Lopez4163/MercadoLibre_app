import ThemeToggle from "../ui/ThemeToggle";

export default function Navbar() {
  return (
    <nav className="border-b border-[var(--border-1)] bg-[var(--surface-1)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="text-lg font-semibold tracking-tight text-[var(--text-1)]">MercadoLibs</div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/login"
            className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
          >
            Login
          </a>
        </div>
      </div>
    </nav>
  );
}
