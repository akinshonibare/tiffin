"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAnthropic, MODEL_HAIKU, DAILY_AI_USD_CAP } from "./client";
import { buildUserContext, contextPrompt } from "./context";
import { requireUser } from "../_helpers";

interface Suggestion {
  categoryId: string;
  suggested: number;
  rationale: string;
}

export const suggestBudgets = action({
  args: {},
  handler: async (ctx): Promise<Suggestion[]> => {
    const userId = await requireUser(ctx);

    const spent = await ctx.runQuery(internal.ai.data.spentTodayUsd, {
      userId,
    });
    if (spent >= DAILY_AI_USD_CAP) return [];

    const [userCtx, transactions, budgets, settings] = await Promise.all([
      buildUserContext(ctx, userId),
      ctx.runQuery(internal.ai.data.listForUser, {
        userId,
        table: "transactions",
      }),
      ctx.runQuery(internal.ai.data.listForUser, {
        userId,
        table: "budgets",
      }),
      ctx.runQuery(internal.ai.data.getSettingsForUser, { userId }),
    ]);

    const now = new Date();
    const months: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }

    const byCat = new Map<string, number[]>();
    for (const t of transactions as any[]) {
      if (!t.categoryId || t.isRefund) continue;
      const m = t.date.slice(0, 7);
      const idx = months.indexOf(m);
      if (idx < 0) continue;
      const arr = byCat.get(t.categoryId) ?? [0, 0, 0];
      arr[idx] += t.amount;
      byCat.set(t.categoryId, arr);
    }

    const summary = Array.from(byCat.entries()).map(([catId, arr]) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      const mean = sum / arr.length;
      const sorted = [...arr].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const cat = userCtx.categories.find((c) => c.id === catId);
      const existingBudget = (budgets as any[]).find(
        (b: any) => b.categoryId === catId,
      );
      return {
        categoryId: catId,
        categoryName: cat?.name ?? catId,
        spentByMonth: arr.map((n) => Math.round(n * 100) / 100),
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        currentBudget: existingBudget?.amount,
      };
    });

    if (summary.length === 0) return [];

    const client = getAnthropic();
    const msg = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: contextPrompt(userCtx),
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text:
            "Suggest a sensible monthly budget for each category. Round to the nearest $5 or $10. Be slightly generous over the mean if spending is volatile, tighter if stable. Give a 1-line rationale. Skip categories with too little signal (spent < $20 over 3 months). Respond as a JSON array of {categoryId, suggested, rationale} only.",
        },
      ],
      messages: [
        {
          role: "user",
          content:
            "Last 3 months by category:\n" +
            JSON.stringify(summary, null, 2) +
            (settings?.overallMonthly
              ? `\n\nUser's overall monthly cap: $${settings.overallMonthly}`
              : ""),
        },
      ],
    });

    const raw = msg.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    let suggestions: Suggestion[] = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) suggestions = JSON.parse(match[0]);
    } catch {}

    await ctx.runMutation(internal.ai.data.logAiCall, {
      userId,
      feature: "suggestBudgets",
      model: MODEL_HAIKU,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    });

    return Array.isArray(suggestions) ? suggestions : [];
  },
});
