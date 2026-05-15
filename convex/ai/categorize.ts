"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAnthropic, MODEL_HAIKU, DAILY_AI_USD_CAP } from "./client";
import { buildUserContext, contextPrompt } from "./context";
import { requireUser } from "../_helpers";

export const suggestCategory = action({
  args: {
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    amount: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { merchant, note, amount },
  ): Promise<{ categoryId: string } | null> => {
    const userId = await requireUser(ctx);

    if (!merchant && !note) return null;

    const spent = await ctx.runQuery(internal.ai.data.spentTodayUsd, {
      userId,
    });
    if (spent >= DAILY_AI_USD_CAP) return null;

    const userCtx = await buildUserContext(ctx, userId);
    if (userCtx.categories.length === 0) return null;

    const validIds = new Set(userCtx.categories.map((c) => c.id));

    const client = getAnthropic();
    const msg = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 40,
      system: [
        {
          type: "text",
          text: contextPrompt(userCtx),
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `Pick the single category from the list above that best fits the transaction. Respond with ONLY the category id (e.g. "cat_abc123") — no prose, no markdown, no explanation. If no category fits well, respond with "none".`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            merchant ? `Merchant: ${merchant}` : null,
            note ? `Note: ${note}` : null,
            amount != null ? `Amount: $${amount.toFixed(2)}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    const raw = msg.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")
      .trim();

    await ctx.runMutation(internal.ai.data.logAiCall, {
      userId,
      feature: "categorize",
      model: MODEL_HAIKU,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    });

    // Extract a cat_* token from the response and validate against user's set.
    const match = raw.match(/cat_[a-z0-9]+/i);
    if (!match) return null;
    const candidate = match[0];
    if (!validIds.has(candidate)) return null;
    return { categoryId: candidate };
  },
});
