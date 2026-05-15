import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./_helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    clientId: v.string(),
    createdAt: v.number(),
    name: v.string(),
    bank: v.string(),
    type: v.union(
      v.literal("chequing"),
      v.literal("savings"),
      v.literal("credit"),
      v.literal("cash"),
      v.literal("other"),
    ),
    color: v.string(),
    last4: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", args.clientId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("accounts", { userId, ...args });
    }
  },
});

export const remove = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("accounts")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", clientId),
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});
