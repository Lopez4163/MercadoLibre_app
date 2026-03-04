"use client";

import { useState } from "react";

type Theme = "light" | "dark";

function getThemeFromStorageOrSystem(): Theme {
  const savedTheme = window.localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.getAttribute("data-theme");
      if (current === "light" || current === "dark") {
        return current;
      }
      return getThemeFromStorageOrSystem();
    }
    return "light";
  });

  function handleToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex h-9 items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)]"
      aria-label="Toggle color theme"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
