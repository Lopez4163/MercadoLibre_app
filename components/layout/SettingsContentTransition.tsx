"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type SettingsContentTransitionProps = {
  children: ReactNode;
};

const transitionEase = [0.22, 1, 0.36, 1] as const;

export default function SettingsContentTransition({ children }: SettingsContentTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.32, ease: transitionEase }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
