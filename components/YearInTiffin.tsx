"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { getDB } from "@/lib/db";
import { money, monthLabel } from "@/lib/format";
import { computeRecords } from "@/lib/easter";

export function YearInTiffin() {
  const [dismissed, setDismissed] = useState(false);
  const allTxs = useLiveQuery(() => getDB().transactions.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);

  const yearKey = useMemo(() => {
    const now = new Date();
    return now.getFullYear() - 1;
  }, []);

  const eligible = useMemo(() => {
    if (!allTxs) return null;
    const now = new Date();
    const m = now.getMonth();
    const d = now.getDate();
    if (m !== 0 || d > 14) return null; // Jan 1–14 only
    const yearStart = `${yearKey}-01-01`;
    const yearEnd = `${yearKey}-12-31`;
    const inYear = allTxs.filter(
      (t) => t.date >= yearStart && t.date <= yearEnd,
    );
    if (inYear.length < 60) return null;
    return inYear;
  }, [allTxs, yearKey]);

  const data = useMemo(() => {
    if (!eligible) return null;
    const total = eligible.reduce((a, t) => a + t.amount, 0);
    const byCat = new Map<string, number>();
    eligible.forEach((t) => {
      if (!t.categoryId) return;
      byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    });
    const topCat = [...byCat.entries()]
      .map(([id, amount]) => ({
        id,
        amount,
        cat: categories?.find((c) => c.id === id),
      }))
      .filter((x) => x.cat)
      .sort((a, b) => b.amount - a.amount)[0];
    const recs = computeRecords(eligible);
    return { total, topCat, records: recs, count: eligible.length };
  }, [eligible, categories]);

  if (dismissed || !data) return null;

  const stored =
    typeof window !== "undefined"
      ? localStorage.getItem(`tiffin.wrapped.${yearKey}`)
      : "1";
  if (stored) return null;

  return (
    <section className="px-5 pt-4">
      <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#a26db3] via-[#5990d0] to-[#62b265] p-5 text-white shadow-lg">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(`tiffin.wrapped.${yearKey}`, "1");
            } catch {}
          }}
          className="absolute right-3 top-3 rounded-full p-1 text-white/70 hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-[10px] uppercase tracking-widest opacity-80"
        >
          ✨ Year in Tiffin
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-display mt-1 text-2xl leading-tight"
        >
          You spent {money(data.total, { whole: true })} in {yearKey}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-3 grid grid-cols-2 gap-2 text-xs"
        >
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <div className="text-[10px] uppercase opacity-80">Top category</div>
            <div className="font-display text-sm leading-tight">
              {data.topCat?.cat?.icon} {data.topCat?.cat?.name ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <div className="text-[10px] uppercase opacity-80">Biggest day</div>
            <div className="font-display text-sm leading-tight">
              {data.records.biggestDay
                ? money(data.records.biggestDay.total, { whole: true })
                : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <div className="text-[10px] uppercase opacity-80">Biggest month</div>
            <div className="font-display text-sm leading-tight">
              {data.records.biggestMonth
                ? monthLabel(data.records.biggestMonth.key)
                : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <div className="text-[10px] uppercase opacity-80">No-spend run</div>
            <div className="font-display text-sm leading-tight">
              {data.records.longestNoSpend}d
            </div>
          </div>
        </motion.div>
        <Link
          href="/summary"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium backdrop-blur"
        >
          See full year <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
