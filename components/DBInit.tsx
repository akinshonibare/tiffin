"use client";

import { useEffect } from "react";
import { ensureSeed } from "@/lib/seed";
import { getActiveKey } from "@/lib/db";

export function DBInit() {
  useEffect(() => {
    const key = getActiveKey();
    ensureSeed(key).catch((err) => console.error("seed failed", err));
  }, []);
  return null;
}
