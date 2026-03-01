export default function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
      <div className="text-lg font-semibold text-slate-900">MercadoLibs</div>
      <div className="flex gap-3">
        <a
          href="/login"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Login
        </a>
      </div>
      </div>
    </nav>
  );
}
