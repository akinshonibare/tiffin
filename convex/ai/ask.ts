"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAnthropic, MODEL_SONNET, DAILY_AI_USD_CAP } from "./client";

const CONVERSATION_TTL_MS = 30 * 60 * 1000;
import { buildUserContext, contextPrompt } from "./context";
import { requireUser } from "../_helpers";

const TOOLS = [
  {
    name: "query_transactions",
    description:
      "Search transactions. Returns up to 200 rows matching the filters.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        categoryId: { type: "string" },
        merchant: { type: "string" },
        minAmount: { type: "number" },
        maxAmount: { type: "number" },
        tag: { type: "string" },
        isRefund: { type: "boolean" },
      },
    },
  },
  {
    name: "get_summary",
    description: "Aggregate transactions by category or merchant.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        groupBy: { type: "string", enum: ["category", "merchant"] },
      },
      required: ["from", "to", "groupBy"],
    },
  },
  {
    name: "get_budgets",
    description: "Current budgets and remaining for the active period.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recurrences",
    description: "Active recurring expenses.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

interface AskInput {
  from?: string;
  to?: string;
  categoryId?: string;
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
  tag?: string;
  isRefund?: boolean;
  groupBy?: "category" | "merchant";
}

async function runTool(
  ctx: any,
  userId: string,
  name: string,
  input: AskInput,
): Promise<unknown> {
  const txs = (await ctx.runQuery(internal.ai.data.listForUser, {
    userId,
    table: "transactions",
  })) as any[];

  function filter(t: any) {
    if (input.from && t.date < input.from) return false;
    if (input.to && t.date > input.to) return false;
    if (input.categoryId && t.categoryId !== input.categoryId) return false;
    if (
      input.merchant &&
      !(t.merchant ?? "").toLowerCase().includes(input.merchant.toLowerCase())
    )
      return false;
    if (input.minAmount !== undefined && t.amount < input.minAmount)
      return false;
    if (input.maxAmount !== undefined && t.amount > input.maxAmount)
      return false;
    if (input.tag && !(t.tags ?? []).includes(input.tag)) return false;
    if (input.isRefund !== undefined && !!t.isRefund !== input.isRefund)
      return false;
    return true;
  }

  if (name === "query_transactions") {
    return txs
      .filter(filter)
      .slice(0, 200)
      .map((t) => ({
        clientId: t.clientId,
        date: t.date,
        amount: t.amount,
        isRefund: t.isRefund,
        categoryId: t.categoryId,
        merchant: t.merchant,
        note: t.note,
        tags: t.tags,
      }));
  }

  if (name === "get_summary") {
    const filtered = txs.filter(filter);
    const map = new Map<string, number>();
    for (const t of filtered) {
      const key =
        input.groupBy === "merchant"
          ? t.merchant ?? "(no merchant)"
          : t.categoryId ?? "(uncategorized)";
      const signed = t.isRefund ? -t.amount : t.amount;
      map.set(key, (map.get(key) ?? 0) + signed);
    }
    return Array.from(map.entries())
      .map(([key, amount]) => ({ key, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }

  if (name === "get_budgets") {
    const budgets = (await ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "budgets",
    })) as any[];
    return budgets.map((b: any) => ({
      categoryId: b.categoryId,
      amount: b.amount,
      period: b.period,
      anchorDate: b.anchorDate,
    }));
  }

  if (name === "get_recurrences") {
    const recs = (await ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "recurrences",
    })) as any[];
    return recs
      .filter((r: any) => r.active)
      .map((r: any) => ({
        name: r.name,
        amount: r.amount,
        period: r.period,
        nextDue: r.nextDue,
      }));
  }

  return null;
}

export const getConversation = action({
  args: {},
  handler: async (ctx): Promise<{ messages: any[] } | null> => {
    const userId = await requireUser(ctx);
    const row = await ctx.runQuery(internal.ai.data.getAskConversation, {
      userId,
    });
    if (!row) return null;
    if (Date.now() - (row.updatedAt ?? 0) > CONVERSATION_TTL_MS) {
      return { messages: [] };
    }
    return { messages: row.messages ?? [] };
  },
});

export const ask = action({
  args: { messages: v.any() },
  handler: async (
    ctx,
    { messages },
  ): Promise<{ messages: any[]; capped?: boolean }> => {
    const userId = await requireUser(ctx);

    const spent = await ctx.runQuery(internal.ai.data.spentTodayUsd, {
      userId,
    });
    if (spent >= DAILY_AI_USD_CAP) {
      return { messages, capped: true };
    }

    // Drop anything older than 30 minutes — fresh session.
    const existing = await ctx.runQuery(
      internal.ai.data.getAskConversation,
      { userId },
    );
    let working: any[];
    if (
      existing &&
      Date.now() - (existing.updatedAt ?? 0) <= CONVERSATION_TTL_MS
    ) {
      working = [...messages];
    } else {
      // Stale: only the latest user turn counts.
      const lastUser = [...messages]
        .reverse()
        .find((m: any) => m.role === "user");
      working = lastUser ? [lastUser] : [...messages];
    }

    const userCtx = await buildUserContext(ctx, userId);
    const client = getAnthropic();

    let totalIn = 0;
    let totalOut = 0;
    for (let i = 0; i < 6; i++) {
      const resp = await client.messages.create({
        model: MODEL_SONNET,
        max_tokens: 1024,
        tools: TOOLS as any,
        system: [
          {
            type: "text",
            text: contextPrompt(userCtx),
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `You are Tiffin's spending assistant. Scope is strict:

- ONLY answer questions about the user's own spending, transactions, budgets, categories, recurring expenses, accounts, and personal-finance patterns derived from their Tiffin data.
- If the user asks anything outside that scope (weather, coding, general knowledge, advice not grounded in their data, opinions on stocks, etc.), respond in one short sentence: "I can only help with your Tiffin spending data — try asking about your expenses, budgets, or categories." Do not engage further.
- Use tools to fetch concrete numbers — never guess or invent figures. If a tool returns empty, say so plainly.
- Do NOT narrate your tool use. No "Let me pull up…", no "Let me check…". Make the tool call and give the answer.
- Reply in 1–3 sentences. Use **markdown** for emphasis (bold figures, bullet lists when comparing 3+ items). Currency as $123.45, or whole dollars when ≥$100.
- No emoji, no exclamation marks, no encouragement. Direct and observational.`,
          },
        ],
        messages: working as any,
      });
      totalIn += resp.usage.input_tokens;
      totalOut += resp.usage.output_tokens;

      working.push({ role: "assistant", content: resp.content });

      if (resp.stop_reason !== "tool_use") break;

      const toolUses = (resp.content as any[]).filter(
        (b: any) => b.type === "tool_use",
      );
      const results: any[] = [];
      for (const tu of toolUses) {
        const out = await runTool(ctx, userId, tu.name, tu.input ?? {});
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(out),
        });
      }
      working.push({ role: "user", content: results });
    }

    await ctx.runMutation(internal.ai.data.logAiCall, {
      userId,
      feature: "ask",
      model: MODEL_SONNET,
      inputTokens: totalIn,
      outputTokens: totalOut,
    });
    await ctx.runMutation(internal.ai.data.saveAskConversation, {
      userId,
      messages: working,
    });

    return { messages: working };
  },
});
