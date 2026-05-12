"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ToastEvent {
  id: number;
  message: string;
  emoji?: string;
  tone?: "default" | "celebrate";
}

let toastId = 0;

export function showToast(
  message: string,
  options?: { emoji?: string; tone?: "default" | "celebrate"; ms?: number },
) {
  if (typeof window === "undefined") return;
  const detail = {
    id: ++toastId,
    message,
    emoji: options?.emoji,
    tone: options?.tone ?? "default",
    ms: options?.ms ?? 1800,
  };
  window.dispatchEvent(new CustomEvent("tiffin:toast", { detail }));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as ToastEvent & { ms: number };
      setToasts((cur) => [...cur, detail]);
      setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== detail.id));
      }, detail.ms);
    }
    window.addEventListener("tiffin:toast", handler);
    return () => window.removeEventListener("tiffin:toast", handler);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-6 z-[60] flex w-full max-w-xs -translate-x-1/2 flex-col items-center gap-2 px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={
              t.tone === "celebrate"
                ? "rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-lg"
                : "rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] shadow-lg"
            }
          >
            {t.emoji && <span className="mr-1.5">{t.emoji}</span>}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
