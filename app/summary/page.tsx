"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDB } from "@/lib/db";
import { money, monthLabel } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { monthPeriodFromKey } from "@/lib/budget";

export default function SummaryPage() {
  const [monthKey, setMonthKey] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );

  const period = useMemo(() => monthPeriodFromKey(monthKey), [monthKey]);
  const txs = useLiveQuery(() => getDB().transactions.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);

  const inMonth = useMemo(
    () =>
      (txs ?? []).filter(
        (t) => t.date >= period.start && t.date <= period.end,
      ),
    [txs, period.start, period.end],
  );

  const total = inMonth.reduce((a, t) => a + t.amount, 0);

  const prevPeriod = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return monthPeriodFromKey(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }, [monthKey]);
  const prevTotal = useMemo(
    () =>
      (txs ?? [])
        .filter((t) => t.date >= prevPeriod.start && t.date <= prevPeriod.end)
        .reduce((a, t) => a + t.amount, 0),
    [txs, prevPeriod.start, prevPeriod.end],
  );

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    inMonth.forEach((t) => {
      if (!t.categoryId) return;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([id, amount]) => {
        const cat = categories?.find((c) => c.id === id);
        return {
          id,
          name: cat?.name ?? "Other",
          color: cat?.color ?? "#94a3b8",
          icon: cat?.icon ?? "✨",
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [inMonth, categories]);

  const byMerchant = useMemo(() => {
    const map = new Map<string, number>();
    inMonth.forEach((t) => {
      const k = t.merchant?.trim();
      if (!k) return;
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [inMonth]);

  const trend = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const p = monthPeriodFromKey(key);
      const sum = (txs ?? [])
        .filter((t) => t.date >= p.start && t.date <= p.end)
        .reduce((a, t) => a + t.amount, 0);
      months.push({
        key,
        label: d.toLocaleDateString("en-CA", { month: "short" }),
        total: Math.round(sum),
      });
    }
    return months;
  }, [txs]);

  const dailyBars = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const arr: { day: number; total: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) arr.push({ day: d, total: 0 });
    inMonth.forEach((t) => {
      const d = Number(t.date.slice(8, 10));
      const idx = d - 1;
      if (idx >= 0 && idx < arr.length) arr[idx].total += t.amount;
    });
    return arr;
  }, [inMonth, monthKey]);

  const noSpendDays = dailyBars.filter((d) => d.total === 0).length;
  const biggest = inMonth.reduce(
    (max, t) => (t.amount > max ? t.amount : max),
    0,
  );
  const delta = total - prevTotal;

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Summary"
        right={<MonthPicker value={monthKey} onChange={setMonthKey} />}
      />

      <section className="px-5">
        <div className="rounded-[28px] bg-[var(--color-surface)] p-6">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            {monthLabel(monthKey)} total
          </div>
          <div className="font-display mt-1 text-5xl tabular">
            {money(total)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-ink-3)]">
            {prevTotal === 0 ? (
              <>no spend in previous month</>
            ) : delta > 0 ? (
              <>
                <span className="text-[var(--color-warn)]">
                  {money(delta)} more
                </span>{" "}
                vs previous month
              </>
            ) : delta < 0 ? (
              <>
                <span className="text-[var(--color-accent)]">
                  {money(Math.abs(delta))} less
                </span>{" "}
                vs previous month
              </>
            ) : (
              <>same as previous month</>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3 px-5">
        <Stat label="Transactions" value={String(inMonth.length)} />
        <Stat label="No-spend days" value={String(noSpendDays)} />
        <Stat label="Biggest" value={money(biggest)} />
      </section>

      <section className="mt-6 px-5">
        <SectionTitle title="Trends · 12 months" />
        <div className="rounded-[22px] bg-[var(--color-surface)] p-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ stroke: "var(--color-line)" }}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v) => money(Number(v) || 0)}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#trendGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {byCat.length > 0 && (
        <section className="mt-6 px-5">
          <SectionTitle title="Where it went" />
          <div className="rounded-[22px] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCat}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {byCat.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {byCat.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: c.color }}
                    />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto tabular text-[var(--color-ink-3)]">
                      {money(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 px-5">
        <SectionTitle title="Daily spend" />
        <div className="rounded-[22px] bg-[var(--color-surface)] p-4">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBars}>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--color-ink-3)" }}
                  interval={4}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v) => money(Number(v) || 0)}
                />
                <Bar
                  dataKey="total"
                  fill="var(--color-accent)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {byMerchant.length > 0 && (
        <section className="mt-6 px-5">
          <SectionTitle title="Top merchants" />
          <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)] px-4">
            {byMerchant.map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="truncate">{m.name}</span>
                <span className="tabular">{money(m.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
      <div className="font-display mt-0.5 text-lg tabular">{value}</div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
      {title}
    </div>
  );
}
