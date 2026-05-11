"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Tags,
  CreditCard,
  Download,
  Upload,
  Trash2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getDB } from "@/lib/db";
import { setTheme } from "@/components/ThemeInit";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const settings = useLiveQuery(() => getDB().settings.get("singleton"), []);
  const counts = useLiveQuery(async () => {
    const db = getDB();
    return {
      tx: await db.transactions.count(),
      cats: await db.categories.count(),
      accts: await db.accounts.count(),
      budgets: await db.budgets.count(),
    };
  }, []);

  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportData() {
    const db = getDB();
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      cards: await db.cards.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      transactions: await db.transactions.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiffin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    const text = await file.text();
    const data = JSON.parse(text);
    const db = getDB();
    await db.transaction(
      "rw",
      db.accounts,
      db.cards,
      db.categories,
      db.budgets,
      db.transactions,
      db.settings,
      async () => {
        if (data.accounts) {
          await db.accounts.clear();
          await db.accounts.bulkAdd(data.accounts);
        }
        if (data.cards) {
          await db.cards.clear();
          await db.cards.bulkAdd(data.cards);
        }
        if (data.categories) {
          await db.categories.clear();
          await db.categories.bulkAdd(data.categories);
        }
        if (data.budgets) {
          await db.budgets.clear();
          await db.budgets.bulkAdd(data.budgets);
        }
        if (data.transactions) {
          await db.transactions.clear();
          await db.transactions.bulkAdd(data.transactions);
        }
        if (data.settings) {
          await db.settings.clear();
          await db.settings.bulkAdd(data.settings);
        }
      },
    );
    alert("Imported successfully.");
  }

  async function resetAll() {
    const db = getDB();
    await db.delete();
    location.reload();
  }

  const theme = settings?.theme ?? "system";

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Tiffin" />

      <section className="px-5">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Logged" value={counts?.tx ?? 0} />
          <Stat label="Categories" value={counts?.cats ?? 0} />
          <Stat label="Accounts" value={counts?.accts ?? 0} />
          <Stat label="Budgets" value={counts?.budgets ?? 0} />
        </div>
      </section>

      <section className="mt-6 px-5">
        <SectionTitle title="Manage" />
        <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)]">
          <Row
            href="/settings/categories"
            icon={<Tags className="size-4" />}
            label="Categories"
            hint="Add, rename, customize"
          />
          <Row
            href="/settings/accounts"
            icon={<CreditCard className="size-4" />}
            label="Banks & cards"
            hint="Manage where money comes from"
          />
        </div>
      </section>

      <section className="mt-6 px-5">
        <SectionTitle title="Appearance" />
        <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-[var(--color-surface)] p-2">
          {(
            [
              { id: "light", label: "Light", icon: Sun },
              { id: "system", label: "System", icon: Monitor },
              { id: "dark", label: "Dark", icon: Moon },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={async () => {
                  setTheme(opt.id);
                  await getDB().settings.update("singleton", { theme: opt.id });
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[16px] py-3 text-xs",
                  active
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-ink-2)]",
                )}
              >
                <Icon className="size-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6 px-5">
        <SectionTitle title="Data" />
        <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)]">
          <button
            type="button"
            onClick={exportData}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <Download className="size-4" />
            <div className="flex-1">
              <div className="text-sm font-medium">Export to JSON</div>
              <div className="text-xs text-[var(--color-ink-3)]">
                Back up everything to a file
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <Upload className="size-4" />
            <div className="flex-1">
              <div className="text-sm font-medium">Import from JSON</div>
              <div className="text-xs text-[var(--color-ink-3)]">
                Replace all data with a backup
              </div>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[var(--color-danger)]"
          >
            <Trash2 className="size-4" />
            <div className="flex-1">
              <div className="text-sm font-medium">Erase all data</div>
              <div className="text-xs text-[var(--color-ink-3)]">
                Removes everything from this device
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="mt-6 mb-10 px-5">
        <div className="text-center text-[11px] text-[var(--color-ink-3)]">
          Tiffin · all data lives on this device
        </div>
      </section>

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-[22px] bg-[var(--color-surface)] p-5">
            <h3 className="text-lg font-medium">Erase all data?</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-3)]">
              This deletes every transaction, category, budget, and account on
              this device. Cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-full border border-[var(--color-line)] py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="flex-1 rounded-full bg-[var(--color-danger)] py-2.5 text-sm font-medium text-white"
              >
                Erase everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[16px] bg-[var(--color-surface)] p-3 text-center">
      <div className="font-display text-xl tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
      {title}
    </div>
  );
}

function Row({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-[var(--color-ink)]"
    >
      <div className="text-[var(--color-ink-2)]">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--color-ink-3)]">{hint}</div>
      </div>
      <span className="text-[var(--color-ink-3)]">›</span>
    </Link>
  );
}
