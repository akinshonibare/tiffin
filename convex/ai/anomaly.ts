"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAnthropic, MODEL_HAIKU, DAILY_AI_USD_CAP } from "./client";
import { requireUser } from "../_helpers";

export const explainAnomalies = action({
  args: {
    items: v.array(
      v.object({
        clientId: v.string(),
        merchant: v.optional(v.string()),
        amount: v.number(),
        mean: v.number(),
        prior: v.number(),
        categoryName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { items }): Promise<Record<string, string>> => {
    const userId = await requireUser(ctx);
    if (items.length === 0) return {};

    const spent = await ctx.runQuery(internal.ai.data.spentTodayUsd, {
      userId,
    });
    if (spent >= DAILY_AI_USD_CAP) return {};

    const client = getAnthropic();
    const msg = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system:
        "You phrase spending anomalies in a single short sentence per item. Mention the multiple vs. usual (e.g. 4× your usual) when it's clean. Never preachy. Return a JSON array, same length, each element a string.",
      messages: [
        {
          role: "user",
          content:
            "Items: " +
            JSON.stringify(items) +
            '\n\nRespond with a JSON array of strings only, no prose. Example: ["This $87 Uber is ~4× your usual.", ...]',
        },
      ],
    });

    const raw = msg.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    let phrasings: string[] = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) phrasings = JSON.parse(match[0]);
    } catch {}

    const out: Record<string, string> = {};
    for (let i = 0; i < items.length; i++) {
      const text = phrasings[i];
      if (typeof text !== "string" || !text.trim()) continue;
      out[items[i].clientId] = text.trim();
      await ctx.runMutation(internal.ai.data.setTransactionAnomaly, {
        userId,
        clientId: items[i].clientId,
        text: text.trim(),
      });
    }

    await ctx.runMutation(internal.ai.data.logAiCall, {
      userId,
      feature: "anomaly",
      model: MODEL_HAIKU,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    });

    return out;
  },
});
