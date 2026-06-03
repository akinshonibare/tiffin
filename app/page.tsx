"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import { getDB } from "@/lib/db";
import { money } from "@/lib/format";
import { currentMonthPeriod, monthPeriodFromKey, signedAmount } from "@/lib/budget";
import { TransactionRow } from "@/components/TransactionRow";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { TiffinWordmark } from "@/components/TiffinWordmark";
import { RecordsSheet } from "@/components/RecordsSheet";
import { YearInTiffin } from "@/components/YearInTiffin";
import { RecurringPendingCard } from "@/components/RecurringPendingCard";
import { BackupReminder } from "@/components/BackupReminder";
import { AiRecap } from "@/components/AiRecap";
import { AskTiffinSheet } from "@/components/AskTiffinSheet";
import { showToast } from "@/components/Toast";
import { findAnomalies, fallbackText } from "@/lib/anomalies";
import { MessageSquareText } from "lucide-react";
import { isClerkConfigured, isConvexConfigured } from "@/lib/convex";
import { useAuthState } from "@/lib/auth";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnomalyExplainer } from "@/components/AnomalyExplainer";
import { buildRecap, listMonthKeysBack } from "@/lib/recap";
import {
  auditMilestones,
  BADGES,
  dejaVuIds,
  earnBadge,
  EMPTY_HOME,
  isFirstLaunchOfDay,
  isFirstOfMonth,
  noSpendStreak,
  pickDeterministic,
  setSecretTheme,
  timeGreeting,
} from "@/lib/easter";
import { useKonamiSwipe } from "@/components/useKonamiSwipe";
import type { Transaction } from "@/lib/types";

export default function HomePage() {
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [showParticle, setShowParticle] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const { isSignedIn } = useAuthState();
  const aiAvailable = isClerkConfigured() && isSignedIn;
  const heroTapsRef = useRef<{ count: number; timer: number | null }>({
    count: 0,
    timer: null,
  });

  const now = useMemo(() => new Date(), []);
  const month = useMemo(() => currentMonthPeriod(now), [now]);
  const prevKey = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.toISOString().slice(0, 7);
  }, [now]);
  const prevMonth = useMemo(() => monthPeriodFromKey(prevKey), [prevKey]);
  const greeting = useMemo(() => timeGreeting(now), [now]);
  const firstOfMonth = useMemo(() => isFirstOfMonth(now), [now]);

  const txs = useLiveQuery(
    () =>
      getDB()
        .transactions.where("date")
        .between(month.start, month.end, true, true)
        .reverse()
        .sortBy("date"),
    [month.start, month.end],
  );
  const prevTxs = useLiveQuery(
    () =>
      getDB()
        .transactions.where("date")
        .between(prevMonth.start, prevMonth.end, true, true)
        .toArray(),
    [prevMonth.start, prevMonth.end],
  );
  const budgets = useLiveQuery(() => getDB().budgets.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);
  const allTxs = useLiveQuery(() => getDB().transactions.toArray(), []);
  const accounts = useLiveQuery(() => getDB().accounts.toArray(), []);
  const settings = useLiveQuery(() => getDB().settings.get("singleton"), []);

  // Convex hooks only valid when the ConvexProvider is mounted. We gate on a
  // stable env-derived constant so the rules-of-hooks count is constant per
  // mount (same trick `useAuthState` uses for Clerk).
  const convexAvailable = isClerkConfigured() && isConvexConfigured();
  /* eslint-disable react-hooks/rules-of-hooks */
  const cloudRecapCompletions = convexAvailable
    ? useQuery(api.recap.listCompletions, isSignedIn ? {} : "skip")
    : undefined;
  const markRecapCompleteCloud = convexAvailable
    ? useMutation(api.recap.markComplete)
    : null;
  /* eslint-enable react-hooks/rules-of-hooks */

  const recapAvailable = useMemo(() => {
    if (!allTxs || !categories || !accounts) return null;
    const cloudKeys = new Set(
      (cloudRecapCompletions ?? []).map((c) => c.monthKey),
    );
    // Walk back up to a year, surface the most recent month that is eligible
    // (buildRecap returns a puzzle) AND not already completed locally/in cloud.
    for (const key of listMonthKeysBack(new Date(), 12)) {
      let localDone = false;
      try {
        const raw = localStorage.getItem(`tiffin.recap.${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { done?: boolean };
          localDone = parsed?.done === true;
        }
      } catch {}
      if (localDone || cloudKeys.has(key)) continue;
      const puzzle = buildRecap(key, allTxs, categories, accounts);
      if (puzzle) return { puzzle, monthKey: key };
    }
    return null;
  }, [allTxs, categories, accounts, cloudRecapCompletions]);

  // Push any locally-completed months that haven't reached the cloud yet
  // (e.g. user finished the puzzle while signed out, then signed back in).
  useEffect(() => {
    if (!isSignedIn) return;
    if (!cloudRecapCompletions) return;
    if (!markRecapCompleteCloud) return;
    try {
      const cloudKeys = new Set(cloudRecapCompletions.map((c) => c.monthKey));
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("tiffin.recap.") || k === "tiffin.recap.demo") continue;
        const monthKey = k.slice("tiffin.recap.".length);
        if (cloudKeys.has(monthKey)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        let parsed: { done?: boolean; won?: boolean } | null = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!parsed?.done) continue;
        markRecapCompleteCloud({
          monthKey,
          completedAt: Date.now(),
          won: parsed.won === true,
        }).catch((err) =>
          console.error("Failed to sync local recap completion", err),
        );
      }
    } catch {}
  }, [isSignedIn, cloudRecapCompletions, markRecapCompleteCloud]);

  const total = (txs ?? []).reduce((a, t) => a + signedAmount(t), 0);
  const prevTotal = (prevTxs ?? []).reduce((a, t) => a + signedAmount(t), 0);
  const delta = total - prevTotal;
  const overall = settings?.overallMonthly ?? 0;
  const summedCategoryBudgets = (budgets ?? [])
    .filter((b) => b.period === "monthly")
    .reduce((a, b) => a + b.amount, 0);
  const monthlyBudget = overall > 0 ? overall : summedCategoryBudgets;
  const budgetLabel = overall > 0 ? "monthly cap" : "monthly budget";
  const budgetPct = monthlyBudget > 0 ? Math.min(1, total / monthlyBudget) : 0;

  const noSpend = useMemo(
    () => noSpendStreak(allTxs ?? [], now),
    [allTxs, now],
  );
  const dejaSet = useMemo(() => dejaVuIds(txs ?? []), [txs]);

  const anomalies = useMemo(
    () => findAnomalies(allTxs ?? [], now),
    [allTxs, now],
  );
  const anomalyMap = useMemo(() => {
    const m = new Map<string, { text: string }>();
    for (const a of anomalies) {
      const tx = (allTxs ?? []).find((t) => t.id === a.txId);
      m.set(a.txId, { text: tx?.anomalyText ?? fallbackText(a) });
    }
    return m;
  }, [anomalies, allTxs]);

  // AnomalyExplainer below handles the LLM phrasing call when aiAvailable.
  const topAnomaly = useMemo(() => {
    if (!txs) return null;
    const currentMonthIds = new Set(txs.map((t) => t.id));
    const inMonth = anomalies.filter((a) => currentMonthIds.has(a.txId));
    if (inMonth.length === 0) return null;
    return inMonth.reduce((a, b) => (a.amount > b.amount ? a : b));
  }, [anomalies, txs]);

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    (txs ?? []).forEach((t) => {
      if (!t.categoryId) return;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + signedAmount(t));
    });
    return Array.from(map.entries())
      .map(([id, amount]) => ({
        id,
        amount,
        cat: categories?.find((c) => c.id === id),
      }))
      .filter((x) => x.cat)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [txs, categories]);

  const emptyCopy = useMemo(
    () =>
      pickDeterministic(
        EMPTY_HOME,
        new Date().toISOString().slice(0, 10),
      ),
    [],
  );

  // First-launch-of-day particle
  useEffect(() => {
    if (isFirstLaunchOfDay()) {
      setShowParticle(true);
      const t = setTimeout(() => setShowParticle(false), 3200);
      return () => clearTimeout(t);
    }
  }, []);

  // Retroactive badge audit — runs once when txs are loaded.
  const auditedRef = useRef(false);
  useEffect(() => {
    if (auditedRef.current) return;
    if (!allTxs) return;
    auditedRef.current = true;
    const newly = auditMilestones(allTxs);
    if (newly.length === 0) return;
    // Stagger toasts so they don't overlap.
    newly.forEach((id, i) => {
      const b = BADGES[id];
      setTimeout(
        () =>
          showToast(`${b.title} unlocked`, {
            emoji: b.emoji,
            tone: "celebrate",
            ms: 2400,
          }),
        400 + i * 700,
      );
    });
  }, [allTxs]);

  // No-spend streak badges
  useEffect(() => {
    if (noSpend >= 3 && earnBadge("no-spend-3"))
      celebrate("no-spend-3");
    if (noSpend >= 7 && earnBadge("no-spend-7"))
      celebrate("no-spend-7");
    if (noSpend >= 14 && earnBadge("no-spend-14"))
      celebrate("no-spend-14");
  }, [noSpend]);

  // Under-month badge — earn on the 1st when prev month was lighter
  useEffect(() => {
    if (
      prevTotal > 0 &&
      total > 0 &&
      total < prevTotal &&
      firstOfMonth &&
      earnBadge("under-month")
    )
      celebrate("under-month");
  }, [prevTotal, total, firstOfMonth]);

  // Budget Hero — every category budget held for the previous month
  useEffect(() => {
    if (!firstOfMonth) return;
    if (!budgets || budgets.length === 0) return;
    if (!prevTxs || prevTxs.length === 0) return;
    const monthlyOnly = budgets.filter((b) => b.period === "monthly");
    if (monthlyOnly.length === 0) return;
    const heldAll = monthlyOnly.every((b) => {
      const spent = prevTxs
        .filter((t) => t.categoryId === b.categoryId)
        .reduce((a, t) => a + t.amount, 0);
      return spent <= b.amount;
    });
    if (heldAll && earnBadge("budget-hero")) celebrate("budget-hero");
  }, [firstOfMonth, budgets, prevTxs]);

  // Konami → Tiffin Gold
  useKonamiSwipe(() => {
    const current = document.documentElement.dataset.secretTheme;
    if (current === "gold") {
      setSecretTheme(null);
      showToast("Tiffin Gold disabled", { emoji: "🪙" });
    } else {
      setSecretTheme("gold");
      showToast("Tiffin Gold unlocked", {
        emoji: "✨",
        tone: "celebrate",
        ms: 2400,
      });
    }
  });

  // Apply secret theme on mount
  useEffect(() => {
    const t = localStorage.getItem("tiffin.secretTheme");
    if (t) document.documentElement.dataset.secretTheme = t;
  }, []);

  function celebrate(id: keyof typeof BADGES) {
    const b = BADGES[id];
    showToast(`${b.title} unlocked`, {
      emoji: b.emoji,
      tone: "celebrate",
      ms: 2800,
    });
  }

  const handleHeroTap = useCallback(() => {
    const ref = heroTapsRef.current;
    ref.count += 1;
    if (ref.timer) window.clearTimeout(ref.timer);
    ref.timer = window.setTimeout(() => {
      ref.count = 0;
    }, 700);
    if (ref.count >= 3) {
      ref.count = 0;
      if (ref.timer) window.clearTimeout(ref.timer);
      setRecordsOpen(true);
    }
  }, []);

  return (
    <div>
      <header className="safe-top relative flex items-end justify-between px-5 pt-3 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            {greeting} · {month.label}
            {firstOfMonth && (
              <span className="ml-1.5 rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] tracking-normal text-[var(--color-accent)]">
                ✨ fresh start
              </span>
            )}
          </div>
          <TiffinWordmark />
        </div>
        <div className="flex items-center gap-2">
          {noSpend >= 3 && (
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[11px] text-[var(--color-ink-2)]">
              <span>🧘</span> {noSpend} no-spend
            </div>
          )}
          {aiAvailable && (
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[11px] text-[var(--color-ink-2)]"
              aria-label="Ask Tiffin"
            >
              <MessageSquareText className="size-3" /> Ask
            </button>
          )}
        </div>
        <AnimatePresence>
          {showParticle && (
            <motion.span
              key="particle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: -160 }}
              transition={{ duration: 3, times: [0, 0.1, 0.7, 1] }}
              className="pointer-events-none absolute left-12 top-0 text-xl"
            >
              ✨
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      <YearInTiffin />
      <RecurringPendingCard />
      <BackupReminder />

      <section className="px-5">
        <div className="rounded-[28px] bg-[var(--color-surface)] p-6">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Spent this month
          </div>
          <div
            onClick={handleHeroTap}
            className="font-display mt-1 cursor-pointer text-5xl tabular select-none"
          >
            {money(total)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-ink-3)]">
            {prevTotal === 0 ? (
              <>vs {money(0)} last month</>
            ) : delta === 0 ? (
              <>same as last month</>
            ) : delta > 0 ? (
              <>
                <span className="text-[var(--color-warn)]">
                  ↑ {money(delta)} more
                </span>{" "}
                than last month
              </>
            ) : (
              <>
                <span className="text-[var(--color-accent)]">
                  ↓ {money(Math.abs(delta))} less
                </span>{" "}
                than last month
              </>
            )}
          </div>

          {monthlyBudget > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-ink-3)]">
                <span>
                  Of {money(monthlyBudget)} {budgetLabel}
                </span>
                <span className="tabular">
                  {Math.round(budgetPct * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${budgetPct * 100}%`,
                    background:
                      budgetPct >= 1
                        ? "var(--color-danger)"
                        : budgetPct > 0.85
                          ? "var(--color-warn)"
                          : "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <AiRecap month={month.start.slice(0, 7)} />

      {recapAvailable && (
        <section className="mt-4 px-5">
          <Link
            href={`/play/recap?month=${recapAvailable.monthKey}`}
            className="group flex items-center gap-3 overflow-hidden rounded-[22px] bg-[var(--color-ink)] p-4 text-[var(--color-bg)]"
          >
            <div className="flex flex-col gap-0.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#f5c542]" />
              <span className="h-2.5 w-2.5 rounded-sm bg-[#62b265]" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#5990d0]" />
              <span className="h-2.5 w-2.5 rounded-sm bg-[#a26db3]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70">
                <Sparkles className="size-3" />
                New puzzle
              </div>
              <div className="font-display text-lg leading-tight">
                {recapAvailable.puzzle.monthLabel} Recap
              </div>
              <div className="text-xs opacity-70">
                Group last month's expenses by week
              </div>
            </div>
            <ChevronRight className="size-5 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      )}

      {byCat.length > 0 && (
        <section className="mt-6 px-5">
          <SectionHeader title="Top categories" />
          <div className="rounded-[22px] bg-[var(--color-surface)] p-2">
            {byCat.map((row) => {
              const pct = total > 0 ? row.amount / total : 0;
              return (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <span className="text-lg">{row.cat?.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="truncate text-sm font-medium">
                        {row.cat?.name}
                      </div>
                      <div className="tabular text-sm">{money(row.amount)}</div>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct * 100}%`,
                          background: row.cat?.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 px-5">
        <SectionHeader
          title="Recent activity"
          right={
            <Link
              href="/transactions"
              className="text-xs text-[var(--color-ink-3)] underline-offset-4 hover:underline"
            >
              See all
            </Link>
          }
        />
        <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)] px-4">
          {(txs ?? []).length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--color-ink-3)]">
              {emptyCopy}
              <br />
              Tap <strong>Add expense</strong> to log one.
            </div>
          )}
          {(txs ?? []).slice(0, 6).map((t) => (
            <TransactionRow
              key={t.id}
              tx={t}
              dejaVu={dejaSet.has(t.id)}
              anomalous={anomalyMap.has(t.id)}
              anomalyText={anomalyMap.get(t.id)?.text}
              onClick={() => {
                setEditing(t);
                setEditOpen(true);
              }}
            />
          ))}
        </div>
      </section>

      <AddTransactionSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={editing}
      />
      <RecordsSheet
        open={recordsOpen}
        onClose={() => setRecordsOpen(false)}
      />
      <AskTiffinSheet open={askOpen} onClose={() => setAskOpen(false)} />
      {aiAvailable && (
        <AnomalyExplainer
          anomalies={anomalies}
          transactions={allTxs ?? []}
          categories={categories ?? []}
        />
      )}
      {topAnomaly && (
        <section className="mt-4 px-5">
          <div className="rounded-[22px] border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-4 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-warn)]">
              Unusual this month
            </div>
            <div className="mt-1 font-medium">
              {fallbackText(topAnomaly)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {title}
      </h2>
      {right}
    </div>
  );
}
