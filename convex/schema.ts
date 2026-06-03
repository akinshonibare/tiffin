import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    migratedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  accounts: defineTable({
    userId: v.string(),
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
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),

  cards: defineTable({
    userId: v.string(),
    clientId: v.string(),
    createdAt: v.number(),
    accountId: v.string(),
    nickname: v.string(),
    last4: v.optional(v.string()),
    color: v.string(),
    archived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),

  categories: defineTable({
    userId: v.string(),
    clientId: v.string(),
    createdAt: v.number(),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    archived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),

  budgets: defineTable({
    userId: v.string(),
    clientId: v.string(),
    createdAt: v.number(),
    categoryId: v.string(),
    amount: v.number(),
    period: v.union(v.literal("monthly"), v.literal("biweekly")),
    anchorDate: v.string(),
    rollover: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),

  transactions: defineTable({
    userId: v.string(),
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
    anomalyText: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"])
    .index("by_user_date", ["userId", "date"]),

  recurrences: defineTable({
    userId: v.string(),
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
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),

  userSettings: defineTable({
    userId: v.string(),
    theme: v.string(),
    currency: v.string(),
    biweeklyAnchor: v.optional(v.string()),
    overallMonthly: v.optional(v.number()),
    backupCadence: v.optional(v.string()),
    lastExportAt: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  userBadges: defineTable({
    userId: v.string(),
    data: v.any(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  recapBlurbs: defineTable({
    userId: v.string(),
    month: v.string(),
    text: v.string(),
    generatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_month", ["userId", "month"]),

  askConversations: defineTable({
    userId: v.string(),
    messages: v.any(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  recapCompletions: defineTable({
    userId: v.string(),
    monthKey: v.string(),
    completedAt: v.number(),
    won: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_month", ["userId", "monthKey"]),

  aiCalls: defineTable({
    userId: v.string(),
    feature: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),
});
