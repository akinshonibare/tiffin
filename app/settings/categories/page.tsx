"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { getDB, uid } from "@/lib/db";
import { repo } from "@/lib/repo";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

const ICON_CHOICES = [
  "🛒",
  "🍽️",
  "🏠",
  "🚇",
  "✈️",
  "🔁",
  "💊",
  "🛍️",
  "🎉",
  "🧾",
  "✨",
  "☕",
  "🎬",
  "🎮",
  "📚",
  "🐶",
  "🚗",
  "⛽",
  "🍕",
  "🥗",
  "💪",
  "💼",
  "🎁",
  "🍷",
];
const COLOR_CHOICES = [
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f59e0b",
  "#84cc16",
  "#64748b",
  "#94a3b8",
];

export default function CategoriesPage() {
  const cats = useLiveQuery(
    () => getDB().categories.filter((c) => !c.archived).toArray(),
    [],
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-3" /> Settings
          </Link>
        }
        title="Categories"
        right={
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
            className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
          >
            <Plus className="size-3.5" /> New
          </button>
        }
      />

      <section className="px-5">
        <div className="grid grid-cols-2 gap-3">
          {(cats ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setEditing(c);
                setOpen(true);
              }}
              className="flex items-center gap-3 rounded-[18px] bg-[var(--color-surface)] p-3 text-left"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                style={{ background: c.color + "22" }}
              >
                {c.icon}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <CategoryEditor
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function CategoryEditor({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Category;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setIcon(editing.icon);
      setColor(editing.color);
    } else {
      setName("");
      setIcon(ICON_CHOICES[0]);
      setColor(COLOR_CHOICES[0]);
    }
  }, [open, editing]);

  const valid = name.trim().length > 0;

  async function save() {
    if (!valid) return;
    if (editing) {
      await repo.categories.update(editing.id, {
        name: name.trim(),
        icon,
        color,
      });
    } else {
      await repo.categories.put({
        id: uid("cat_"),
        name: name.trim(),
        icon,
        color,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await repo.categories.update(editing.id, { archived: true });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit category" : "New category"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm text-[var(--color-danger)]"
            >
              Archive
            </button>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={save}
            className="flex-1 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-col items-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
          style={{ background: color + "22" }}
        >
          {icon}
        </div>
      </div>

      <Field label="Name">
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Coffee"
          className="w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-base outline-none"
        />
      </Field>

      <Field label="Icon">
        <div className="grid grid-cols-8 gap-2">
          {ICON_CHOICES.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl text-xl transition-colors",
                icon === i
                  ? "bg-[var(--color-ink)]"
                  : "bg-[var(--color-surface-2)]",
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn(
                "h-9 w-9 rounded-full transition-transform",
                color === c
                  ? "ring-2 ring-[var(--color-ink)] ring-offset-2 ring-offset-[var(--color-surface)]"
                  : "",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
      {children}
    </div>
  );
}
