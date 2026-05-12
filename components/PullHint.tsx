"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pick, PULL_REFRESH_HINTS } from "@/lib/easter";

/**
 * Watches for the iOS-style overscroll/rubber-band on the page itself
 * (window scrollY pulled below 0) and surfaces a playful hint.
 */
export function PullHint() {
  const [hint, setHint] = useState<string | null>(null);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if ((window.scrollY || document.documentElement.scrollTop) <= 0) {
        startY.current = e.touches[0].clientY;
        armed.current = true;
      } else {
        armed.current = false;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!armed.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 90 && !hint) setHint(pick(PULL_REFRESH_HINTS));
    }
    function onTouchEnd() {
      armed.current = false;
      startY.current = null;
      if (hint) {
        const t = setTimeout(() => setHint(null), 900);
        return () => clearTimeout(t);
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [hint]);

  return (
    <AnimatePresence>
      {hint && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="pointer-events-none fixed left-1/2 top-2 z-[55] -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-3 py-1 text-[11px] text-[var(--color-bg)] shadow"
        >
          {hint}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
