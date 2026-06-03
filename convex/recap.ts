import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./_helpers";

// List all completed recap months for the signed-in user. Returns an array of
// { monthKey, completedAt, won } — the home-page card uses this to know
// whether the previous month's puzzle has already been solved on any device.
export const listCompletions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("recapCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => ({
      monthKey: r.monthKey,
      completedAt: r.completedAt,
      won: r.won,
    }));
  },
});

// Mark a month's recap puzzle as completed. Idempotent — keeps the earliest
// completion timestamp and OR's the `won` flag so a later replay-win doesn't
// regress to a loss.
export const markComplete = mutation({
  args: {
    monthKey: v.string(),
    completedAt: v.number(),
    won: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("recapCompletions")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        won: existing.won || args.won,
        completedAt: Math.min(existing.completedAt, args.completedAt),
      });
      return;
    }
    await ctx.db.insert("recapCompletions", {
      userId,
      monthKey: args.monthKey,
      completedAt: args.completedAt,
      won: args.won,
    });
  },
});
