"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Delete, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import {
  KEYBOARD,
  emojiRow,
  evaluateGuess,
  todaysWord,
  type Verdict,
} from "@/lib/wordle";

const MAX_GUESSES = 6;
const WORD_LEN = 5;

interface SavedState {
  date: string;
  guesses: string[];
  done: boolean;
  won: boolean;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): SavedState {
  if (typeof window === "undefined") {
    return { date: todayKey(), guesses: [], done: false, won: false };
  }
  try {
    const raw = localStorage.getItem("tiffin.play.state");
    if (!raw) return { date: todayKey(), guesses: [], done: false, won: false };
    const parsed = JSON.parse(raw) as SavedState;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), guesses: [], done: false, won: false };
    }
    return parsed;
  } catch {
    return { date: todayKey(), guesses: [], done: false, won: false };
  }
}

function saveState(s: SavedState) {
  try {
    localStorage.setItem("tiffin.play.state", JSON.stringify(s));
  } catch {}
}

export default function PlayPage() {
  const answer = useMemo(() => todaysWord(), []);
  const [state, setState] = useState<SavedState>(() => loadState());
  const [current, setCurrent] = useState("");
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const showToast = useCallback((msg: string, ms = 1400) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  const submit = useCallback(() => {
    if (state.done) return;
    if (current.length !== WORD_LEN) {
      setShake(true);
      setTimeout(() => setShake(false), 350);
      showToast("Not enough letters");
      return;
    }
    const upper = current.toUpperCase();
    const nextGuesses = [...state.guesses, upper];
    const won = upper === answer;
    const done = won || nextGuesses.length >= MAX_GUESSES;
    setState({ ...state, guesses: nextGuesses, done, won });
    setCurrent("");
    if (won) showToast("Nailed it ✨", 1800);
    else if (done) showToast(`Today was ${answer}`, 2200);
  }, [current, state, answer, showToast]);

  const onKey = useCallback(
    (k: string) => {
      if (state.done) return;
      if (k === "ENTER") return submit();
      if (k === "BACK") return setCurrent((c) => c.slice(0, -1));
      if (current.length >= WORD_LEN) return;
      if (!/^[A-Z]$/.test(k)) return;
      setCurrent((c) => c + k);
    },
    [current, state.done, submit],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (key === "Enter") return onKey("ENTER");
      if (key === "Backspace") return onKey("BACK");
      if (/^[a-zA-Z]$/.test(key)) return onKey(key.toUpperCase());
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  const rows: { letters: string[]; verdicts: Verdict[] | null }[] = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (i < state.guesses.length) {
      const g = state.guesses[i];
      rows.push({
        letters: g.split(""),
        verdicts: evaluateGuess(g, answer),
      });
    } else if (i === state.guesses.length) {
      const letters = current.padEnd(WORD_LEN, " ").split("");
      rows.push({ letters, verdicts: null });
    } else {
      rows.push({ letters: Array(WORD_LEN).fill(" "), verdicts: null });
    }
  }

  const keyVerdicts = useMemo(() => {
    const map = new Map<string, Verdict>();
    state.guesses.forEach((g) => {
      const v = evaluateGuess(g, answer);
      g.split("").forEach((ch, i) => {
        const prev = map.get(ch);
        const next = v[i];
        if (
          prev === "correct" ||
          (prev === "present" && next === "absent")
        )
          return;
        map.set(ch, next);
      });
    });
    return map;
  }, [state.guesses, answer]);

  async function share() {
    const date = new Date().toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
    const score = state.won ? state.guesses.length : "X";
    const grid = state.guesses
      .map((g) => emojiRow(evaluateGuess(g, answer)))
      .join("\n");
    const txt = `Tiffin · ${date} · ${score}/${MAX_GUESSES}\n\n${grid}`;
    try {
      await navigator.clipboard.writeText(txt);
      showToast("Copied to clipboard", 1500);
    } catch {
      showToast("Couldn't copy", 1500);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-3" /> Home
          </Link>
        }
        title="Daily"
        right={
          state.done ? (
            <button
              type="button"
              onClick={share}
              className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
            >
              <Share2 className="size-3.5" /> Share
            </button>
          ) : (
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              5 letters · 6 tries
            </span>
          )
        }
      />

      <section className="px-5">
        <motion.div
          animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto grid max-w-[320px] gap-1.5"
        >
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-5 gap-1.5">
              {row.letters.map((c, ci) => {
                const v = row.verdicts?.[ci];
                const filled = c !== " ";
                return (
                  <motion.div
                    key={ci}
                    initial={false}
                    animate={
                      v
                        ? {
                            rotateX: [0, 90, 0],
                            background: [
                              "var(--color-surface)",
                              "var(--color-surface)",
                              v === "correct"
                                ? "#22c55e"
                                : v === "present"
                                  ? "#eab308"
                                  : "#6b7280",
                            ],
                            color: [
                              "var(--color-ink)",
                              "var(--color-ink)",
                              "#ffffff",
                            ],
                            borderColor: [
                              "var(--color-line)",
                              "var(--color-line)",
                              "transparent",
                            ],
                          }
                        : filled
                          ? {
                              scale: [1, 1.06, 1],
                              borderColor: "var(--color-ink)",
                            }
                          : { scale: 1, borderColor: "var(--color-line)" }
                    }
                    transition={{
                      duration: v ? 0.55 : 0.12,
                      delay: v ? ci * 0.18 : 0,
                      ease: "easeInOut",
                    }}
                    style={{ transformPerspective: 600 }}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md border-2 text-xl font-bold uppercase",
                    )}
                  >
                    {filled ? c : ""}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </motion.div>
      </section>

      <section className="mt-6 px-3">
        <div className="space-y-1.5">
          {KEYBOARD.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1">
              {row.map((k) => {
                const v = keyVerdicts.get(k);
                const wide = k === "ENTER" || k === "BACK";
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onKey(k)}
                    className={cn(
                      "h-12 rounded-md text-xs font-semibold uppercase active:scale-95 transition-transform",
                      wide ? "min-w-[58px] px-2 text-[10px]" : "w-8",
                      v === "correct"
                        ? "bg-[#22c55e] text-white"
                        : v === "present"
                          ? "bg-[#eab308] text-white"
                          : v === "absent"
                            ? "bg-[#6b7280] text-white"
                            : "bg-[var(--color-surface)] text-[var(--color-ink)]",
                    )}
                  >
                    {k === "BACK" ? (
                      <Delete className="mx-auto size-4" />
                    ) : (
                      k
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 px-5 text-center text-xs text-[var(--color-ink-3)]">
        A tiny easter egg for Wordle fans · resets at midnight
      </section>

      {toast && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-[var(--color-bg)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
