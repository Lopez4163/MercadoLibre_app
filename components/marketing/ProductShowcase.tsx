"use client";

import Image from "next/image";
import { useState } from "react";

type ShowcaseTab = "overview" | "orders" | "stats";

const SHOWCASE_ITEMS: Record<
  ShowcaseTab,
  {
    label: string;
    title: string;
    description: string;
    imageSrc: string;
    imageAlt: string;
    points: string[];
  }
> = {
  overview: {
    label: "Resumen",
    title: "Mira toda la operacion de un vistazo",
    description: "La vista de resumen muestra primero los numeros y alertas clave para que no saltes entre Mercado Libre y Telegram.",
    imageSrc: "/images/dashboard-img.png",
    imageAlt: "Resumen del panel con tarjetas de rendimiento y actividad reciente",
    points: [
      "Detecta el movimiento del dia sin abrir varias pestanas.",
      "Mira salud de la cuenta, estado de inventario y actividad reciente en un solo lugar.",
      "Empieza en una pantalla antes de entrar a pedidos o tendencias.",
    ],
  },
  orders: {
    label: "Pedidos",
    title: "Gestiona pedidos sin perder contexto",
    description: "La vista de pedidos mantiene flujo reciente, estado de entrega y reintentos en un solo lugar para que el equipo avance rapido.",
    imageSrc: "/images/order-img.png",
    imageAlt: "Pantalla de pedidos con pedidos recientes y acciones de entrega",
    points: [
      "Revisa pedidos entrantes en una cola clara.",
      "Consulta el estado de entrega de notificaciones junto a cada pedido.",
      "Reintenta envios fallidos de Telegram sin salir del panel.",
    ],
  },
  stats: {
    label: "Estadisticas",
    title: "Detecta patrones antes de que se vuelvan problemas",
    description: "La pantalla de estadisticas convierte la actividad diaria en senales claras para ver impulso, riesgo y cambios de tendencia antes.",
    imageSrc: "/images/stats-img.png",
    imageAlt: "Pantalla de estadisticas con graficos y metricas de pedidos",
    points: [
      "Sigue tendencias de rendimiento en vez de reaccionar tarde.",
      "Usa resumenes visuales para entender cambios de volumen rapido.",
      "Detecta cambios de stock y ventas antes de afectar ingresos.",
    ],
  },
};

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("overview");
  const activeItem = SHOWCASE_ITEMS[activeTab];

  return (
    <div className="grid gap-6 md:grid-cols-[1.25fr_0.9fr] md:items-start">
      <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <div className="mb-3 flex flex-wrap gap-2 border-b border-[var(--border-1)] pb-3">
          {(Object.entries(SHOWCASE_ITEMS) as Array<[ShowcaseTab, (typeof SHOWCASE_ITEMS)[ShowcaseTab]]>).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={[
                "inline-flex h-10 items-center border px-4 text-sm font-semibold",
                activeTab === key
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--surface-1)]",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="overflow-hidden border border-[var(--border-1)] bg-[var(--surface-2)]">
          <Image
            src={activeItem.imageSrc}
            alt={activeItem.imageAlt}
            width={1600}
            height={1100}
            className="h-auto w-full"
            priority
          />
        </div>
      </div>

      <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">Recorrido del producto</p>
        <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">{activeItem.title}</h3>
        <p className="mt-3 text-[var(--text-2)]">{activeItem.description}</p>
        <ul className="mt-6 grid gap-3 text-sm text-[var(--text-2)]">
          {activeItem.points.map((point) => (
            <li key={point} className="border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
