"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "@/convex/_generated/api";
import { Sheet } from "./Sheet";
import { isClerkConfigured } from "@/lib/convex";
import { useAuthState } from "@/lib/auth";

interface ChatMessage {
  role: "user" | "assistant";
  content: any;
}

export function AskTiffinSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!isClerkConfigured()) return null;
  return <Inner open={open} onClose={onClose} />;
}

function Inner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isSignedIn } = useAuthState();
  const getConversation = useAction(api.ai.ask.getConversation);
  const ask = useAction(api.ai.ask.ask);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [capped, setCapped] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !isSignedIn) return;
    getConversation({})
      .then((r: { messages: any[] } | null) => {
        if (r && Array.isArray(r.messages)) setMessages(r.messages);
      })
      .catch(console.error);
  }, [open, isSignedIn, getConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const resp = await ask({ messages: next });
      if (resp.capped) {
        setCapped(true);
      } else if (resp.messages) {
        setMessages(resp.messages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (!isSignedIn) return null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ask Tiffin"
      footer={
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Tiffin…"
            rows={1}
            disabled={busy || capped}
            className="min-h-11 flex-1 resize-none rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-sm outline-none disabled:opacity-40"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || capped || !draft.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-bg)] disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-1.5 text-xs text-[var(--color-ink-3)]">
        <Sparkles className="size-3.5" />
        Ask anything about your spending. I'll pull numbers from your data.
      </div>
      <div
        ref={scrollRef}
        className="space-y-2 overflow-y-auto"
      >
        {messages.length === 0 && (
          <div className="space-y-1 rounded-[18px] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-ink-3)]">
            <div>Try:</div>
            <ul className="list-disc pl-5">
              <li>How much did I spend on food last month?</li>
              <li>What's my biggest expense this year?</li>
              <li>Am I on track with my budgets?</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} m={m} />
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-ink-3)]">
              Thinking…
            </div>
          </div>
        )}
        {capped && (
          <div className="rounded-[18px] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-ink-3)]">
            Daily AI limit reached. Try again tomorrow.
          </div>
        )}
      </div>
    </Sheet>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    // A user turn whose content is an array of tool_result blocks is an
    // internal step in Anthropic's tool-use loop — never render it.
    const text = typeof m.content === "string" ? m.content : "";
    if (!text.trim()) return null;
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-[var(--color-ink)] px-3 py-2 text-sm text-[var(--color-bg)]">
          {text}
        </div>
      </div>
    );
  }
  let text = "";
  if (Array.isArray(m.content)) {
    text = m.content
      .filter((b: any) => b && b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
  } else if (typeof m.content === "string") {
    text = m.content;
  }
  if (!text.trim()) return null;
  return (
    <div className="flex justify-start">
      <div className="ask-md max-w-[85%] rounded-2xl bg-[var(--color-surface-2)] px-3 py-2 text-sm">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}
