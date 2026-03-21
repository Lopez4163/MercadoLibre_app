"use client";

import { motion } from "framer-motion";

function SkeletonRow() {
  return <div className="h-9 border border-[var(--border-1)] bg-[var(--bg-0)]/80" aria-hidden="true" />;
}

export default function SettingsLoading() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="w-full self-start"
    >
      <section className="space-y-3 border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-3)]">
          <motion.span
            aria-hidden="true"
            className="h-3 w-3 rounded-full border border-[var(--text-3)] border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
          />
          Cargando configuracion
        </div>

        <div className="space-y-3 animate-pulse">
          <div>
            <div className="h-6 w-56 bg-[var(--surface-2)]" aria-hidden="true" />
            <div className="mt-3 h-4 w-80 max-w-full bg-[var(--surface-2)]" aria-hidden="true" />
            <div className="mt-3 space-y-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </div>

          <div className="pt-1">
            <div className="h-5 w-44 bg-[var(--surface-2)]" aria-hidden="true" />
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
