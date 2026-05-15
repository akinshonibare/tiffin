import { query, mutation } from "./_generated/server";
import { requireUser } from "./_helpers";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row ?? null;
  },
});

export const markMigrated = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { migratedAt: now });
    } else {
      await ctx.db.insert("users", { userId, migratedAt: now });
    }
  },
});

export const deleteSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const tables = [
      "accounts",
      "cards",
      "categories",
      "budgets",
      "transactions",
      "recurrences",
      "userSettings",
      "userBadges",
      "recapBlurbs",
      "askConversations",
      "aiCalls",
      "users",
    ] as const;
    for (const table of tables) {
      const rows = await ctx.db
        .query(table as any)
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();
      for (const r of rows) {
        await ctx.db.delete(r._id);
      }
    }
  },
});
