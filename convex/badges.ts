import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./_helpers";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row ?? null;
  },
});

export const set = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { data, updatedAt });
    } else {
      await ctx.db.insert("userBadges", { userId, data, updatedAt });
    }
  },
});
