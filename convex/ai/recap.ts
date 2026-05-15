"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAnthropic, MODEL_HAIKU, DAILY_AI_USD_CAP } from "./client";
import { buildUserContext, contextPrompt } from "./context";
import { requireUser } from "../_helpers";

function inMonth(date: string, monthKey: string) {
  return date.startsWith(monthKey);
}

export const getRecap = action({
  args: { month: v.string() },
  handler: async (ctx, { month }): Promise<string | null> => {
    const userId = await requireUser(ctx);
    const existing = await ctx.runQuery(internal.ai.data.getRecapBlurb, {
      userId,
      month,
    });
    if (
      existing &&
      Date.now() - existing.generatedAt < 24 * 60 * 60 * 1000
    ) {
      return existing.text;
    }
    return await generate(ctx, userId, month);
  },
});

export const regenerateRecap = action({
  args: { month: v.string() },
  handler: async (ctx, { month }): Promise<string | null> => {
    const userId = await requireUser(ctx);
    return await generate(ctx, userId, month);
  },
});

async function generate(
  ctx: any,
  userId: string,
  month: string,
): Promise<string | null> {
  const spent = await ctx.runQuery(internal.ai.data.spentTodayUsd, {
    userId,
  });
  if (spent >= DAILY_AI_USD_CAP) {
    return null;
  }

  const [userCtx, transactions, budgets, categories, recurrences] =
    await Promise.all([
      buildUserContext(ctx, userId),
      ctx.runQuery(internal.ai.data.listForUser, {
        userId,
        table: "transactions",
      }),
      ctx.runQuery(internal.ai.data.listForUser, {
        userId,
        table: "budgets",
      }),
      ctx.runQuery(internal.ai.data.listForUser, {
        userId,
        table: "categories",
      }),
      ctx.runQuery(internal.ai.data.listForUser, {
        userId,
        table: "recurrences",
      }),
    ]);

  const prevDate = new Date(month + "-01");
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);

  const monthTxs = (transactions as any[]).filter((t: any) =>
    inMonth(t.date, month),
  );
  const prevTxs = (transactions as any[]).filter((t: any) =>
    inMonth(t.date, prevMonth),
  );

  const total = monthTxs.reduce(
    (a: number, t: any) => a + (t.isRefund ? -t.amount : t.amount),
    0,
  );
  const prevTotal = prevTxs.reduce(
    (a: number, t: any) => a + (t.isRefund ? -t.amount : t.amount),
    0,
  );

  const byCategory = new Map<string, number>();
  for (const t of monthTxs) {
    if (!t.categoryId) continue;
    const signed = t.isRefund ? -t.amount : t.amount;
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + signed);
  }
  const topCats = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amt]) => {
      const cat = (categories as any[]).find(
        (c: any) => c.clientId === id,
      );
      return { name: cat?.name ?? id, amount: Math.round(amt * 100) / 100 };
    });

  // Days elapsed / remaining (only meaningful for the current month)
  const today = new Date();
  const monthDate = new Date(month + "-01");
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const isCurrentMonth =
    today.getFullYear() === monthDate.getFullYear() &&
    today.getMonth() === monthDate.getMonth();
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const daysRemaining = isCurrentMonth ? daysInMonth - today.getDate() : 0;
  const dailyPace = daysElapsed > 0 ? total / daysElapsed : 0;
  const projectedTotal = isCurrentMonth
    ? Math.round(dailyPace * daysInMonth * 100) / 100
    : Math.round(total * 100) / 100;

  // Biggest single transaction this month (signal that's not in the UI)
  const sortedByAmount = monthTxs
    .filter((t: any) => !t.isRefund)
    .sort((a: any, b: any) => b.amount - a.amount);
  const biggest = sortedByAmount[0];
  const biggestCatName = biggest
    ? (categories as any[]).find((c: any) => c.clientId === biggest.categoryId)
        ?.name
    : null;

  // Budget overrun signal: which monthly budgets are already exceeded
  const monthlyBudgets = (budgets as any[]).filter(
    (b: any) => b.period === "monthly",
  );
  const overBudget = monthlyBudgets
    .map((b: any) => {
      const spent = byCategory.get(b.categoryId) ?? 0;
      return {
        category:
          (categories as any[]).find((c: any) => c.clientId === b.categoryId)
            ?.name ?? b.categoryId,
        cap: b.amount,
        spent: Math.round(spent * 100) / 100,
        pct: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    })
    .filter((b) => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);

  // Recurring obligations landing in the next 7 days
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const upcomingRecurring = (recurrences as any[])
    .filter((r: any) => r.active && r.nextDue)
    .map((r: any) => ({
      name: r.name,
      amount: r.amount,
      dueIn: Math.round(
        (new Date(r.nextDue).getTime() - today.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    }))
    .filter((r) => r.dueIn >= 0 && r.dueIn <= 7)
    .sort((a, b) => a.dueIn - b.dueIn);
  const upcomingTotal =
    Math.round(
      upcomingRecurring.reduce((a, r) => a + r.amount, 0) * 100,
    ) / 100;

  const stats = {
    month,
    isCurrentMonth,
    daysElapsed,
    daysRemaining,
    total: Math.round(total * 100) / 100,
    prevTotal: Math.round(prevTotal * 100) / 100,
    delta: Math.round((total - prevTotal) * 100) / 100,
    txCount: monthTxs.length,
    topCategories: topCats,
    biggestTransaction: biggest
      ? {
          amount: biggest.amount,
          merchant: biggest.merchant ?? null,
          category: biggestCatName,
          date: biggest.date,
        }
      : null,
    pacing: isCurrentMonth
      ? {
          dailyPace: Math.round(dailyPace * 100) / 100,
          projectedMonthTotal: projectedTotal,
          vsPrevMonthAtSameDayOfMonth: prevTotal > 0
            ? Math.round((total - (prevTotal * daysElapsed) / daysInMonth) * 100) / 100
            : null,
        }
      : null,
    budgetsAtRisk: overBudget,
    upcomingNext7Days: {
      total: upcomingTotal,
      items: upcomingRecurring.slice(0, 4),
    },
  };

  const client = getAnthropic();
  const msg = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 180,
    system: [
      {
        type: "text",
        text: contextPrompt(userCtx),
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `You write two-sentence spending digests for the Tiffin app. Voice is clinical, observational, dry. No coaching, no encouragement, no exclamation points, no emoji.

STRUCTURE — exactly two sentences, in this order:

1. **Observation**: lead with the most non-obvious fact in the data. The UI already shows total spent, top categories, and budget progress — never restate those alone. Surface a pattern: pace vs last month at the same point, biggest transaction, a budget already at risk, an unusual concentration, a comparison.
2. **Forward-looking**: one of (a) projected month-end total based on current pace, (b) upcoming recurring expenses in the next 7 days and their total, (c) which budget is about to break given pace, or (d) for past months — the headline wrap-up (delta vs prior, biggest single tx, or category that drove the month).

RULES:
- No openers like "You spent…", "So far…", "It looks like…", "This month…". Start with the noun, number, or pattern.
- No hedging words: "though", "but", "appears to be", "seems".
- Currency: $123.45 under $100; whole dollars at $100+ ($487, not $487.00).
- isCurrentMonth=false → past-month wrap-up tone. isCurrentMonth=true → forward-looking second sentence.
- Thin data (txCount ≤ 2 AND no budgets AND no upcoming recurring): collapse to ONE factual sentence under 12 words, no projection.
- No markdown, no headings.

Good examples (current month):
"$487 on groceries puts you at 121% of your $400 budget with two weeks left. At this pace, total spend lands near $1,820 by month-end."
"Pace is tracking $180 below May at the same point. Three recurring bills totaling $245 hit between Tuesday and Friday."
"Air Canada at $743 is the month's outlier — everything else stays under $50. No recurring bills until the 28th."

Good examples (past month):
"April closed at $2,140, $310 over March, driven entirely by a $560 mechanic bill on the 12th. Groceries held to $380 — your $400 cap."
"Closed 8% under March with no category breaking budget. Biggest single hit was rent at $1,800."

Thin-data example:
"One transaction in May so far — $120 at the pharmacy."`,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Stats:\n${JSON.stringify(stats, null, 2)}`,
      },
    ],
  });

  const text =
    msg.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim() || null;

  if (!text) return null;

  await ctx.runMutation(internal.ai.data.upsertRecapBlurb, {
    userId,
    month,
    text,
  });
  await ctx.runMutation(internal.ai.data.logAiCall, {
    userId,
    feature: "recap",
    model: MODEL_HAIKU,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  });
  return text;
}
