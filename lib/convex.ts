"use client";

import { ConvexReactClient } from "convex/react";

let _client: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (typeof window === "undefined") {
    throw new Error("Convex client is browser-only");
  }
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    _client = new ConvexReactClient(url);
  }
  return _client;
}

export function isConvexConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
