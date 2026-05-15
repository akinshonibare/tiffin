"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sparkles, RefreshCw } from "lucide-react";
import { isClerkConfigured } from "@/lib/convex";
import { useAuthState } from "@/lib/auth";

export function AiRecap({ month }: { month: string }) {
  if (!isClerkConfigured()) return null;
  return <Inner month={month} />;
}

function Inner({ month }: { month: string }) {
  const { isSignedIn } = useAuthState();
  const getRecap = useAction(api.ai.recap.getRecap);
  const regenerate = useAction(api.ai.recap.regenerateRecap);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    setError(false);
    getRecap({ month })
      .then((t: string | null) => setText(t))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isSignedIn, month, getRecap]);

  async function refresh() {
    setLoading(true);
    setError(false);
    try {
      const t = await regenerate({ month });
      setText(t);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!isSignedIn) return null;
  if (!loading && !text && !error) return null;

  return (
    <section className="mt-3 px-5">
      <div className="flex items-start gap-2 px-1">
        <Sparkles className="mt-[3px] size-3 shrink-0 text-[var(--color-ink-3)]" />
        <div className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--color-ink-2)]">
          {loading ? (
            <span className="inline-block h-3 w-48 animate-pulse rounded bg-[var(--color-surface-2)]" />
          ) : error ? (
            <span className="text-[var(--color-ink-3)]">
              Couldn't generate a recap right now.
            </span>
          ) : (
            text
          )}
        </div>
        {!loading && !error && (
          <button
            type="button"
            onClick={refresh}
            aria-label="Regenerate recap"
            className="-mt-0.5 shrink-0 rounded-full p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)]"
          >
            <RefreshCw className="size-3" />
          </button>
        )}
      </div>
    </section>
  );
}
