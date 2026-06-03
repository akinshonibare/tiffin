import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./_helpers";

const accountValidator = v.object({
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
});

const cardValidator = v.object({
  clientId: v.string(),
  createdAt: v.number(),
  accountId: v.string(),
  nickname: v.string(),
  last4: v.optional(v.string()),
  color: v.string(),
  archived: v.optional(v.boolean()),
});

const categoryValidator = v.object({
  clientId: v.string(),
  createdAt: v.number(),
  name: v.string(),
  icon: v.string(),
  color: v.string(),
  archived: v.optional(v.boolean()),
});

const budgetValidator = v.object({
  clientId: v.string(),
  createdAt: v.number(),
  categoryId: v.string(),
  amount: v.number(),
  period: v.union(v.literal("monthly"), v.literal("biweekly")),
  anchorDate: v.string(),
  rollover: v.optional(v.boolean()),
});

const transactionValidator = v.object({
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
});

const recurrenceValidator = v.object({
  clientId: v.string(),
  createdAt: v.number(),
  name: v.string(),
  amount: v.number(),
  period: v.union(
    v.literal("weekly"),
    v.literal("biweekly"),
    v.literal("monthly"),
  ),
  nextDue: v.string(),
  accountId: v.optional(v.string()),
  cardId: v.optional(v.string()),
  categoryId: v.optional(v.string()),
  merchant: v.optional(v.string()),
  note: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  active: v.boolean(),
});

const settingsValidator = v.object({
  theme: v.string(),
  currency: v.string(),
  biweeklyAnchor: v.optional(v.string()),
  overallMonthly: v.optional(v.number()),
  backupCadence: v.optional(v.string()),
  lastExportAt: v.optional(v.string()),
});

const payload = {
  accounts: v.array(accountValidator),
  cards: v.array(cardValidator),
  categories: v.array(categoryValidator),
  budgets: v.array(budgetValidator),
  transactions: v.array(transactionValidator),
  recurrences: v.array(recurrenceValidator),
  settings: v.optional(settingsValidator),
  badges: v.optional(v.any()),
};

async function clearUserData(ctx: any, userId: string) {
  const tables = [
    "accounts",
    "cards",
    "categories",
    "budgets",
    "transactions",
    "recurrences",
  ] as const;
  for (const table of tables) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
}

export const replaceAll = mutation({
  args: payload,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await clearUserData(ctx, userId);

    for (const a of args.accounts)
      await ctx.db.insert("accounts", { userId, ...a });
    for (const c of args.cards) await ctx.db.insert("cards", { userId, ...c });
    for (const c of args.categories)
      await ctx.db.insert("categories", { userId, ...c });
    for (const b of args.budgets)
      await ctx.db.insert("budgets", { userId, ...b });
    for (const t of args.transactions)
      await ctx.db.insert("transactions", { userId, ...t });
    for (const r of args.recurrences)
      await ctx.db.insert("recurrences", { userId, ...r });

    if (args.settings) {
      const existing = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, args.settings);
      else await ctx.db.insert("userSettings", { userId, ...args.settings });
    }

    if (args.badges !== undefined) {
      const existing = await ctx.db
        .query("userBadges")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const updatedAt = Date.now();
      if (existing) {
        await ctx.db.patch(existing._id, { data: args.badges, updatedAt });
      } else {
        await ctx.db.insert("userBadges", {
          userId,
          data: args.badges,
          updatedAt,
        });
      }
    }

    const userRow = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (userRow) await ctx.db.patch(userRow._id, { migratedAt: Date.now() });
    else await ctx.db.insert("users", { userId, migratedAt: Date.now() });
  },
});

// Upsert by clientId: insert if missing, patch if present. Used when a user
// signed back in with local edits and confirmed they want those edits applied
// to their cloud account.
export const applyLocalChanges = mutation({
  args: payload,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    async function upsertByClient(table: any, doc: any) {
      const existing = await ctx.db
        .query(table)
        .withIndex("by_user_client", (q: any) =>
          q.eq("userId", userId).eq("clientId", doc.clientId),
        )
        .unique();
      if (existing) {
        const { clientId: _cid, createdAt: _ca, ...patch } = doc;
        void _cid;
        void _ca;
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert(table, { userId, ...doc });
      }
    }

    for (const a of args.accounts) await upsertByClient("accounts", a);
    for (const c of args.cards) await upsertByClient("cards", c);
    for (const c of args.categories) await upsertByClient("categories", c);
    for (const b of args.budgets) await upsertByClient("budgets", b);
    for (const t of args.transactions) await upsertByClient("transactions", t);
    for (const r of args.recurrences) await upsertByClient("recurrences", r);

    if (args.settings) {
      const existing = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, args.settings);
      else await ctx.db.insert("userSettings", { userId, ...args.settings });
    }

    const userRow = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (userRow) await ctx.db.patch(userRow._id, { migratedAt: Date.now() });
    else await ctx.db.insert("users", { userId, migratedAt: Date.now() });
  },
});

export const mergeLocal = mutation({
  args: payload,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    async function insertIfMissing(table: any, clientId: string, doc: any) {
      const existing = await ctx.db
        .query(table)
        .withIndex("by_user_client", (q: any) =>
          q.eq("userId", userId).eq("clientId", clientId),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert(table, { userId, ...doc });
      }
    }

    for (const a of args.accounts)
      await insertIfMissing("accounts", a.clientId, a);
    for (const c of args.cards)
      await insertIfMissing("cards", c.clientId, c);
    for (const c of args.categories)
      await insertIfMissing("categories", c.clientId, c);
    for (const b of args.budgets)
      await insertIfMissing("budgets", b.clientId, b);
    for (const t of args.transactions)
      await insertIfMissing("transactions", t.clientId, t);
    for (const r of args.recurrences)
      await insertIfMissing("recurrences", r.clientId, r);

    if (args.settings) {
      const existing = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (!existing) {
        await ctx.db.insert("userSettings", { userId, ...args.settings });
      }
    }

    if (args.badges !== undefined) {
      const existing = await ctx.db
        .query("userBadges")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (!existing) {
        await ctx.db.insert("userBadges", {
          userId,
          data: args.badges,
          updatedAt: Date.now(),
        });
      }
    }

    const userRow = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (userRow) await ctx.db.patch(userRow._id, { migratedAt: Date.now() });
    else await ctx.db.insert("users", { userId, migratedAt: Date.now() });
  },
});
