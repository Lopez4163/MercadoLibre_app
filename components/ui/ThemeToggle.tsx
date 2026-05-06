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
      className="inline-flex h-9 items-center justify-center rounded border border-[#4b4731] bg-[#1e1c10] px-3 text-xs font-semibold uppercase tracking-wide text-[#cdc7aa] hover:border-[#85cfff] hover:text-white"
      aria-label="Cambiar tema de color"
      title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
    >
      {theme === "dark" ? "Claro" : "Oscuro"}
    </button>
  );
}
