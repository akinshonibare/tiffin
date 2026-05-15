"use node";

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export interface UserContext {
  categories: { id: string; name: string; icon: string }[];
  accounts: { id: string; name: string; bank: string; type: string }[];
  recentMerchants: string[];
}

export async function buildUserContext(
  ctx: ActionCtx,
  userId: string,
): Promise<UserContext> {
  const [categories, accounts, transactions] = await Promise.all([
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "categories",
    }),
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "accounts",
    }),
    ctx.runQuery(internal.ai.data.listForUser, {
      userId,
      table: "transactions",
    }),
  ]);

  const merchantFreq = new Map<string, number>();
  for (const t of (transactions as any[]) ?? []) {
    if (t.merchant) {
      merchantFreq.set(t.merchant, (merchantFreq.get(t.merchant) ?? 0) + 1);
    }
  }
  const recentMerchants = Array.from(merchantFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([m]) => m);

  return {
    categories: ((categories as any[]) ?? [])
      .filter((c) => !c.archived)
      .map((c) => ({ id: c.clientId, name: c.name, icon: c.icon })),
    accounts: ((accounts as any[]) ?? [])
      .filter((a) => !a.archived)
      .map((a) => ({
        id: a.clientId,
        name: a.name,
        bank: a.bank,
        type: a.type,
      })),
    recentMerchants,
  };
}

export function contextPrompt(ctx: UserContext): string {
  return [
    "You assist a user inside the Tiffin expense tracker.",
    "Currency is CAD. Be concise and warm — no preachy budgeting advice.",
    "",
    "Categories:",
    ctx.categories.map((c) => `- ${c.id}: ${c.icon} ${c.name}`).join("\n"),
    "",
    "Accounts:",
    ctx.accounts
      .map((a) => `- ${a.id}: ${a.name} (${a.bank}, ${a.type})`)
      .join("\n"),
    "",
    "Recent merchants:",
    ctx.recentMerchants.join(", "),
  ].join("\n");
}
