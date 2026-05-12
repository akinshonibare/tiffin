"use client";

import { useEffect, useRef } from "react";

// Konami code mapped to swipe/key directions: ↑ ↑ ↓ ↓ ← → ← → B A
// For touch we use the 8-direction prefix (↑ ↑ ↓ ↓ ← → ← →).
const SEQUENCE = ["up", "up", "down", "down", "left", "right", "left", "right"];

type Dir = "up" | "down" | "left" | "right";

export function useKonamiSwipe(onUnlock: () => void) {
  const idxRef = useRef(0);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const cooldownRef = useRef(0);

  useEffect(() => {
    function reset() {
      idxRef.current = 0;
    }
    function step(dir: Dir) {
      const need = SEQUENCE[idxRef.current];
      if (dir === need) {
        idxRef.current += 1;
        if (idxRef.current >= SEQUENCE.length) {
          idxRef.current = 0;
          const now = Date.now();
          if (now - cooldownRef.current > 1500) {
            cooldownRef.current = now;
            onUnlock();
          }
        }
      } else if (dir === SEQUENCE[0]) {
        idxRef.current = 1;
      } else {
        reset();
      }
    }

    function onKey(e: KeyboardEvent) {
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const d = map[e.key];
      if (d) step(d);
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    }

    function onTouchEnd(e: TouchEvent) {
      const s = startRef.current;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Date.now() - s.t;
      startRef.current = null;
      if (dt > 700) return reset();
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < 40) return; // too small, not a swipe
      const dir: Dir =
        absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      step(dir);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onUnlock]);
}
