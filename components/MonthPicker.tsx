"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/format";

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  function shift(delta: number) {
    const [y, m] = value.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    onChange(next);
  }
  return (
    <div className="flex items-center gap-2 rounded-full bg-[var(--color-surface-2)] px-2 py-1.5">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Previous month"
        className="rounded-full p-1 text-[var(--color-ink-2)] hover:bg-[var(--color-surface)]"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="min-w-[120px] text-center text-sm font-medium">
        {monthLabel(value)}
      </div>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="Next month"
        className="rounded-full p-1 text-[var(--color-ink-2)] hover:bg-[var(--color-surface)]"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
