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
    label: "Overview",
    title: "See the whole operation in one glance",
    description: "The overview screen surfaces the numbers and alerts that matter first, so you do not need to bounce between Mercado Libre and Telegram.",
    imageSrc: "/images/dashboard-img.png",
    imageAlt: "Dashboard overview showing performance cards and recent activity",
    points: [
      "Spot today’s movement without opening multiple tabs.",
      "See account health, inventory posture, and recent activity together.",
      "Start from one screen before drilling into orders or trends.",
    ],
  },
  orders: {
    label: "Orders",
    title: "Work through orders without losing context",
    description: "The orders view keeps recent order flow, delivery state, and retry actions visible in one place so your team can move fast.",
    imageSrc: "/images/order-img.png",
    imageAlt: "Orders screen showing recent orders and delivery actions",
    points: [
      "Review incoming orders in a structured queue.",
      "Check notification delivery status beside each order.",
      "Retry failed Telegram sends without leaving the dashboard.",
    ],
  },
  stats: {
    label: "Stats",
    title: "Watch patterns before they become problems",
    description: "The stats screen turns daily activity into clear signals so you can see momentum, risk, and trend changes earlier.",
    imageSrc: "/images/stats-img.png",
    imageAlt: "Stats screen showing charts and summarized order metrics",
    points: [
      "Track performance trends instead of reacting too late.",
      "Use visual summaries to understand volume shifts quickly.",
      "Catch stock and sales changes before they hurt revenue.",
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
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">Live Product Tour</p>
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
