import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./_helpers";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row ?? null;
  },
});

export const set = mutation({
  args: {
    theme: v.string(),
    currency: v.string(),
    biweeklyAnchor: v.optional(v.string()),
    overallMonthly: v.optional(v.number()),
    backupCadence: v.optional(v.string()),
    lastExportAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userSettings", { userId, ...args });
    }
  },
});

export const patch = mutation({
  args: {
    theme: v.optional(v.string()),
    currency: v.optional(v.string()),
    biweeklyAnchor: v.optional(v.string()),
    overallMonthly: v.optional(v.number()),
    backupCadence: v.optional(v.string()),
    lastExportAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        theme: args.theme ?? "system",
        currency: args.currency ?? "CAD",
        biweeklyAnchor: args.biweeklyAnchor,
        overallMonthly: args.overallMonthly,
        backupCadence: args.backupCadence,
        lastExportAt: args.lastExportAt,
      });
    }
  },
});
