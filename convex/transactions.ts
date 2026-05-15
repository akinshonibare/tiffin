import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./_helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    clientId: v.string(),
    createdAt: v.number(),
    amount: v.number(),
    date: v.string(),
    accountId: v.optional(v.string()),
    cardId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isRefund: v.optional(v.boolean()),
    recurrenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", args.clientId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("transactions", { userId, ...args });
    }
  },
});

export const remove = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("transactions")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", clientId),
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const setAnomalyText = mutation({
  args: { clientId: v.string(), text: v.string() },
  handler: async (ctx, { clientId, text }) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("transactions")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", clientId),
      )
      .unique();
    if (row) await ctx.db.patch(row._id, { anomalyText: text });
  },
});
