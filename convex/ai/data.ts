import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const listForUser = internalQuery({
  args: { userId: v.string(), table: v.string() },
  handler: async (ctx, { userId, table }) => {
    return await ctx.db
      .query(table as any)
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
  },
});

export const getSettingsForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getRecapBlurb = internalQuery({
  args: { userId: v.string(), month: v.string() },
  handler: async (ctx, { userId, month }) => {
    return await ctx.db
      .query("recapBlurbs")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("month", month),
      )
      .unique();
  },
});

export const upsertRecapBlurb = internalMutation({
  args: { userId: v.string(), month: v.string(), text: v.string() },
  handler: async (ctx, { userId, month, text }) => {
    const existing = await ctx.db
      .query("recapBlurbs")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("month", month),
      )
      .unique();
    const generatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { text, generatedAt });
    } else {
      await ctx.db.insert("recapBlurbs", {
        userId,
        month,
        text,
        generatedAt,
      });
    }
  },
});

export const setTransactionAnomaly = internalMutation({
  args: { userId: v.string(), clientId: v.string(), text: v.string() },
  handler: async (ctx, { userId, clientId, text }) => {
    const row = await ctx.db
      .query("transactions")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", clientId),
      )
      .unique();
    if (row) await ctx.db.patch(row._id, { anomalyText: text });
  },
});

export const logAiCall = internalMutation({
  args: {
    userId: v.string(),
    feature: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiCalls", { ...args, createdAt: Date.now() });
  },
});

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

export const spentTodayUsd = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await ctx.db
      .query("aiCalls")
      .withIndex("by_user_created", (q) =>
        q.eq("userId", userId).gte("createdAt", startOfDay.getTime()),
      )
      .collect();
    let total = 0;
    for (const r of rows) {
      const p = PRICING[r.model] ?? { input: 3, output: 15 };
      total +=
        (r.inputTokens * p.input + r.outputTokens * p.output) / 1_000_000;
    }
    return total;
  },
});

export const getAskConversation = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("askConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const saveAskConversation = internalMutation({
  args: { userId: v.string(), messages: v.any() },
  handler: async (ctx, { userId, messages }) => {
    const existing = await ctx.db
      .query("askConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { messages, updatedAt });
    } else {
      await ctx.db.insert("askConversations", { userId, messages, updatedAt });
    }
  },
});
