"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TARGET = "TIFFIN";

export function TiffinWordmark() {
  const router = useRouter();
  const [taps, setTaps] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function onTap() {
    if (revealing) return;
    setTaps((t) => {
      const next = t + 1;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setTaps(0), 1500);
      if (next >= 5) {
        if (resetTimer.current) clearTimeout(resetTimer.current);
        triggerReveal();
        return 0;
      }
      return next;
    });
  }

  function triggerReveal() {
    setRevealing(true);
    try {
      localStorage.setItem("tiffin.play.unlocked", "1");
    } catch {}
    setTimeout(() => router.push("/play"), 1450);
  }

  if (revealing) {
    return (
      <div className="flex items-center gap-1.5">
        {TARGET.split("").map((c, i) => (
          <motion.span
            key={i}
            initial={{ rotateX: 0, background: "transparent" }}
            animate={{
              rotateX: [0, 90, 0],
              background: ["transparent", "#22c55e", "#22c55e"],
              color: ["#0a0a0a", "#ffffff", "#ffffff"],
            }}
            transition={{
              duration: 0.55,
              delay: i * 0.13,
              times: [0, 0.5, 1],
              ease: "easeInOut",
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-base font-semibold uppercase"
            style={{ transformPerspective: 600 }}
          >
            {c}
          </motion.span>
        ))}
      </div>
    );
  }

  return (
    <h1
      onClick={onTap}
      className="font-display cursor-pointer text-3xl select-none"
    >
      Tiffin
      <AnimatePresence>
        {taps > 0 && taps < 5 && (
          <motion.span
            key={taps}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 0.6, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ background: "var(--color-accent)" }}
          />
        )}
      </AnimatePresence>
    </h1>
  );
}
