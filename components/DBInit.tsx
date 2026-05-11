"use client";

import { useEffect } from "react";
import { ensureSeed } from "@/lib/seed";

export function DBInit() {
  useEffect(() => {
    ensureSeed().catch((err) => console.error("seed failed", err));
  }, []);
  return null;
}
