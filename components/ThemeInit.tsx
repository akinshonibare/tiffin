"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("tiffin.theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    const theme = stored ?? "system";
    apply(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => {
      const cur = (localStorage.getItem("tiffin.theme") as
        | "light"
        | "dark"
        | "system"
        | null) ?? "system";
      if (cur === "system") apply("system");
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  return null;
}

function apply(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function setTheme(theme: "light" | "dark" | "system") {
  localStorage.setItem("tiffin.theme", theme);
  apply(theme);
}
