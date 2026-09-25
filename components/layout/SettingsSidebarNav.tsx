"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsNavItems = [
  {
    href: "/settings/notifications",
    label: "Notificaciones",
    description: "Reglas de alerta y umbrales",
  },
  {
    href: "/settings/mercadolibre",
    label: "Mercado Libre",
    description: "Conexion y acceso de cuenta",
  },
  {
    href: "/settings/telegram",
    label: "Telegram",
    description: "Canal de entrega y prueba",
  },
  {
    href: "/settings/billing",
    label: "Facturacion",
    description: "Estado de prueba y suscripcion",
  },
  {
    href: "/settings/profile",
    label: "Perfil",
    description: "Identidad de cuenta y conexiones",
  },
  {
    href: "/settings/feedback",
    label: "Comentarios",
    description: "Reporta errores y comparte ideas",
  },
];

export default function SettingsSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="border border-[var(--border-1)] bg-[var(--surface-1)] p-3">
      <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Configuracion</p>
      <div className="mt-3 space-y-1">
        {settingsNavItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block border px-3 py-3 transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-transparent bg-transparent hover:border-[var(--text-2)] hover:bg-[var(--surface-2)] active:translate-y-px active:bg-[var(--bg-0)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--text-1)]">{item.label}</p>
              <p className="mt-1 text-xs text-[var(--text-3)]">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
