/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers from "../_helpers.js";
import type * as accounts from "../accounts.js";
import type * as ai_anomaly from "../ai/anomaly.js";
import type * as ai_ask from "../ai/ask.js";
import type * as ai_categorize from "../ai/categorize.js";
import type * as ai_client from "../ai/client.js";
import type * as ai_context from "../ai/context.js";
import type * as ai_data from "../ai/data.js";
import type * as ai_recap from "../ai/recap.js";
import type * as ai_suggestBudgets from "../ai/suggestBudgets.js";
import type * as badges from "../badges.js";
import type * as budgets from "../budgets.js";
import type * as cards from "../cards.js";
import type * as categories from "../categories.js";
import type * as migration from "../migration.js";
import type * as recap from "../recap.js";
import type * as recurrences from "../recurrences.js";
import type * as settings from "../settings.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _helpers: typeof _helpers;
  accounts: typeof accounts;
  "ai/anomaly": typeof ai_anomaly;
  "ai/ask": typeof ai_ask;
  "ai/categorize": typeof ai_categorize;
  "ai/client": typeof ai_client;
  "ai/context": typeof ai_context;
  "ai/data": typeof ai_data;
  "ai/recap": typeof ai_recap;
  "ai/suggestBudgets": typeof ai_suggestBudgets;
  badges: typeof badges;
  budgets: typeof budgets;
  cards: typeof cards;
  categories: typeof categories;
  migration: typeof migration;
  recap: typeof recap;
  recurrences: typeof recurrences;
  settings: typeof settings;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
