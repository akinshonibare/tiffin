"use node";

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export interface UserContext {
  categories: { id: string; name: string; icon: string }[];
  accounts: { id: string; name: string; bank: string; type: string }[];
  recentMerchants: string[];
}

export async function buildUserContext(
  ctx: ActionCtx,
  userId: string,
): Promise<UserContext> {
  const [categories, accounts, transactions] = await Promise.all([
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "categories",
    }),
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "accounts",
    }),
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "transactions",
    }),
  ]);

  const merchantFreq = new Map<string, number>();
  for (const t of (transactions as any[]) ?? []) {
    if (t.merchant) {
      merchantFreq.set(t.merchant, (merchantFreq.get(t.merchant) ?? 0) + 1);
    }
  }
  const recentMerchants = Array.from(merchantFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([m]) => m);

  return {
    categories: ((categories as any[]) ?? [])
      .filter((c) => !c.archived)
      .map((c) => ({ id: c.clientId, name: c.name, icon: c.icon })),
    accounts: ((accounts as any[]) ?? [])
      .filter((a) => !a.archived)
      .map((a) => ({
        id: a.clientId,
        name: a.name,
        bank: a.bank,
        type: a.type,
      })),
    recentMerchants,
  };
}

export function contextPrompt(ctx: UserContext): string {
  return [
    "You assist a user inside the Tiffin expense tracker.",
    "Currency is CAD. Be concise and warm — no preachy budgeting advice.",
    "",
    "Categories:",
    ctx.categories.map((c) => `- ${c.id}: ${c.icon} ${c.name}`).join("\n"),
    "",
    "Accounts:",
    ctx.accounts
      .map((a) => `- ${a.id}: ${a.name} (${a.bank}, ${a.type})`)
      .join("\n"),
    "",
    "Recent merchants:",
    ctx.recentMerchants.join(", "),
  ].join("\n");
}

// ---- "Now" snapshot for grounding live questions like "am I on track?" ----

export interface NowSnapshot {
  todayIso: string;
  monthKey: string;
  prevMonthKey: string;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  monthToDateTotal: number;
  prevMonthTotal: number;
  prevMonthSameDayPace: number | null;
  projectedMonthTotal: number;
  topCategoriesThisMonth: { name: string; amount: number }[];
  budgets: {
    category: string;
    cap: number;
    spent: number;
    pct: number;
    period: string;
  }[];
  upcomingRecurringNext7Days: { name: string; amount: number; dueIn: number }[];
  upcomingRecurringTotal: number;
}

function inMonth(date: string, monthKey: string) {
  return date.startsWith(monthKey);
}

export async function buildNowSnapshot(
  ctx: ActionCtx,
  userId: string,
): Promise<NowSnapshot> {
  const [transactions, budgets, categories, recurrences] = await Promise.all([
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "transactions",
    }),
    ctx.runQuery(internal.ai.data.listForUser, { userId, table: "budgets" }),
    ctx.runQuery(internal.ai.data.listForUser, { userId, table: "categories" }),
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "recurrences",
    }),
  ]);

  const today = new Date();
  const monthKey = today.toISOString().slice(0, 7);
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthKey = prevDate.toISOString().slice(0, 7);
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const daysElapsed = today.getDate();
  const daysRemaining = daysInMonth - daysElapsed;

  const txs = (transactions as any[]) ?? [];
  const monthTxs = txs.filter((t) => inMonth(t.date, monthKey));
  const prevTxs = txs.filter((t) => inMonth(t.date, prevMonthKey));

  const monthToDateTotal = round2(
    monthTxs.reduce(
      (a, t) => a + (t.isRefund ? -t.amount : t.amount),
      0,
    ),
  );
  const prevMonthTotal = round2(
    prevTxs.reduce((a, t) => a + (t.isRefund ? -t.amount : t.amount), 0),
  );
  const prevMonthSameDayPace =
    prevMonthTotal > 0
      ? round2((prevMonthTotal * daysElapsed) / daysInMonth)
      : null;
  const projectedMonthTotal =
    daysElapsed > 0
      ? round2((monthToDateTotal / daysElapsed) * daysInMonth)
      : monthToDateTotal;

  // Top categories this month
  const cats = (categories as any[]) ?? [];
  const byCat = new Map<string, number>();
  for (const t of monthTxs) {
    if (!t.categoryId) continue;
    const signed = t.isRefund ? -t.amount : t.amount;
    byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + signed);
  }
  const topCategoriesThisMonth = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amt]) => {
      const cat = cats.find((c) => c.clientId === id);
      return { name: cat?.name ?? id, amount: round2(amt) };
    });

  // Budgets with utilization (monthly + biweekly summarized; period text only)
  const allBudgets = ((budgets as any[]) ?? []).map((b: any) => {
    const cat = cats.find((c) => c.clientId === b.categoryId);
    const spent = byCat.get(b.categoryId) ?? 0;
    return {
      category: cat?.name ?? b.categoryId,
      cap: b.amount,
      spent: round2(spent),
      pct: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      period: b.period as string,
    };
  });

  // Upcoming recurrences in next 7 days
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const upcomingRecurringNext7Days = ((recurrences as any[]) ?? [])
    .filter((r: any) => r.active && r.nextDue)
    .map((r: any) => ({
      name: r.name as string,
      amount: r.amount as number,
      dueIn: Math.round(
        (new Date(r.nextDue).getTime() - today.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    }))
    .filter((r) => r.dueIn >= 0 && r.dueIn <= 7)
    .sort((a, b) => a.dueIn - b.dueIn);
  const upcomingRecurringTotal = round2(
    upcomingRecurringNext7Days.reduce((a, r) => a + r.amount, 0),
  );

  return {
    todayIso: today.toISOString().slice(0, 10),
    monthKey,
    prevMonthKey,
    daysElapsed,
    daysInMonth,
    daysRemaining,
    monthToDateTotal,
    prevMonthTotal,
    prevMonthSameDayPace,
    projectedMonthTotal,
    topCategoriesThisMonth,
    budgets: allBudgets,
    upcomingRecurringNext7Days,
    upcomingRecurringTotal,
  };
}

export function snapshotPrompt(snap: NowSnapshot): string {
  return [
    "# Live snapshot (use as ground truth — do NOT re-fetch via tools unless the user asks for something outside this).",
    `Today: ${snap.todayIso} (day ${snap.daysElapsed} of ${snap.daysInMonth}, ${snap.daysRemaining} days remaining)`,
    `Current month: ${snap.monthKey} · Spent: $${snap.monthToDateTotal} · Projected month-end at current pace: $${snap.projectedMonthTotal}`,
    `Previous month (${snap.prevMonthKey}): Spent $${snap.prevMonthTotal}` +
      (snap.prevMonthSameDayPace != null
        ? ` · Last month at this same day of month: ~$${snap.prevMonthSameDayPace}`
        : ""),
    "",
    "Top categories this month:",
    snap.topCategoriesThisMonth.length === 0
      ? "  (none)"
      : snap.topCategoriesThisMonth
          .map((c) => `  - ${c.name}: $${c.amount}`)
          .join("\n"),
    "",
    "Budgets:",
    snap.budgets.length === 0
      ? "  (none set)"
      : snap.budgets
          .map(
            (b) =>
              `  - ${b.category} (${b.period}): $${b.spent} / $${b.cap} (${b.pct}%)`,
          )
          .join("\n"),
    "",
    "Recurring expenses landing in the next 7 days:",
    snap.upcomingRecurringNext7Days.length === 0
      ? "  (none)"
      : snap.upcomingRecurringNext7Days
          .map(
            (r) =>
              `  - ${r.name}: $${r.amount} in ${r.dueIn} day${r.dueIn === 1 ? "" : "s"}`,
          )
          .join("\n") +
        `\n  Subtotal: $${snap.upcomingRecurringTotal}`,
  ].join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
