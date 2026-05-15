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
  Repeat,
  BellRing,
} from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getDB } from "@/lib/db";
import { repo } from "@/lib/repo";
import { setTheme } from "@/components/ThemeInit";
import { AccountSection } from "@/components/AccountSection";
import { AskTiffinSheet } from "@/components/AskTiffinSheet";
import { useAuthState } from "@/lib/auth";
import { Cloud, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Account,
  BackupCadence,
  Budget,
  Card,
  Category,
  Settings,
  Transaction,
} from "@/lib/types";

export default function SettingsPage() {
  const { isSignedIn } = useAuthState();
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
  const [askOpen, setAskOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: ImportShape;
    fileName: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportData() {
    const db = getDB();
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      cards: await db.cards.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      transactions: await db.transactions.toArray(),
      recurrences: await db.recurrences.toArray(),
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
    await repo.settings.update({
      lastExportAt: new Date().toISOString(),
    });
  }

  async function stageImport(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ImportShape;
      if (
        !data ||
        typeof data !== "object" ||
        (!Array.isArray(data.accounts) &&
          !Array.isArray(data.transactions) &&
          !Array.isArray(data.categories))
      ) {
        setImportError(
          "This file doesn't look like a Tiffin backup.",
        );
        return;
      }
      setPendingImport({ data, fileName: file.name });
    } catch {
      setImportError("Couldn't read this file as JSON.");
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    const { data } = pendingImport;
    const db = getDB();
    try {
      await db.transaction(
        "rw",
        [
          db.accounts,
          db.cards,
          db.categories,
          db.budgets,
          db.transactions,
          db.recurrences,
          db.settings,
        ],
        async () => {
          if (Array.isArray(data.accounts)) {
            await db.accounts.clear();
            await db.accounts.bulkAdd(data.accounts);
          }
          if (Array.isArray(data.cards)) {
            await db.cards.clear();
            await db.cards.bulkAdd(data.cards);
          }
          if (Array.isArray(data.categories)) {
            await db.categories.clear();
            await db.categories.bulkAdd(data.categories);
          }
          if (Array.isArray(data.budgets)) {
            await db.budgets.clear();
            await db.budgets.bulkAdd(data.budgets);
          }
          if (Array.isArray(data.transactions)) {
            await db.transactions.clear();
            await db.transactions.bulkAdd(data.transactions);
          }
          if (Array.isArray(data.recurrences)) {
            await db.recurrences.clear();
            await db.recurrences.bulkAdd(data.recurrences);
          }
          if (Array.isArray(data.settings)) {
            await db.settings.clear();
            await db.settings.bulkAdd(data.settings);
          }
        },
      );
      setPendingImport(null);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Import failed.",
      );
    } finally {
      setImporting(false);
    }
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
        <SectionTitle title="Account" />
        <AccountSection />
      </section>

      <section className="mt-6 px-5">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Logged" value={counts?.tx ?? 0} />
          <Stat label="Categories" value={counts?.cats ?? 0} />
          <Stat label="Accounts" value={counts?.accts ?? 0} />
          <Stat label="Budgets" value={counts?.budgets ?? 0} />
        </div>
      </section>

      {isSignedIn && (
        <section className="mt-6 px-5">
          <SectionTitle title="AI" />
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="flex w-full items-center gap-3 rounded-[22px] bg-[var(--color-surface)] px-4 py-3 text-left"
          >
            <MessageSquareText className="size-4 text-[var(--color-ink-2)]" />
            <div className="flex-1">
              <div className="text-sm font-medium">Ask Tiffin</div>
              <div className="text-xs text-[var(--color-ink-3)]">
                Ask anything about your spending
              </div>
            </div>
            <span className="text-[var(--color-ink-3)]">›</span>
          </button>
        </section>
      )}

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
          <Row
            href="/settings/recurring"
            icon={<Repeat className="size-4" />}
            label="Recurring expenses"
            hint="Subscriptions, rent, bills"
          />
        </div>
      </section>

      {!isSignedIn && (
        <section className="mt-6 px-5">
          <SectionTitle title="Backup reminder" />
          <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-[var(--color-surface)] p-2">
            {(
              [
                { id: "off", label: "Off" },
                { id: "biweekly", label: "2 weeks" },
                { id: "monthly", label: "Monthly" },
              ] as const
            ).map((opt) => {
              const active = (settings?.backupCadence ?? "off") === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={async () => {
                    await repo.settings.update({
                      backupCadence: opt.id as BackupCadence,
                    });
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-[16px] py-3 text-xs",
                    active
                      ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                      : "text-[var(--color-ink-2)]",
                  )}
                >
                  {opt.id !== "off" && <BellRing className="size-3.5" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11px] text-[var(--color-ink-3)]">
            {settings?.backupCadence && settings.backupCadence !== "off"
              ? `A nudge will appear on Home when it's been ${settings.backupCadence === "biweekly" ? "14" : "30"} days since your last export.`
              : "When on, Tiffin reminds you to export a JSON snapshot."}
          </p>
        </section>
      )}

      {isSignedIn && (
        <section className="mt-6 px-5">
          <SectionTitle title="Backup" />
          <div className="flex items-center gap-3 rounded-[22px] bg-[var(--color-surface)] px-4 py-3">
            <Cloud className="size-4 text-[var(--color-ink-3)]" />
            <div className="text-sm text-[var(--color-ink-2)]">
              Synced to your account
              <div className="text-[11px] text-[var(--color-ink-3)]">
                Manual backups aren't needed while signed in.
              </div>
            </div>
          </div>
        </section>
      )}

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
                  await repo.settings.update({ theme: opt.id });
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
              if (f) stageImport(f);
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

      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-[22px] bg-[var(--color-surface)] p-5">
            <h3 className="text-lg font-medium">Replace all data?</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-3)]">
              About to import{" "}
              <span className="text-[var(--color-ink-2)]">
                {pendingImport.fileName}
              </span>
              . Every transaction, category, budget, and account on this
              device will be replaced. Cannot be undone.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ImportStat
                label="Logged"
                value={pendingImport.data.transactions?.length ?? 0}
              />
              <ImportStat
                label="Categories"
                value={pendingImport.data.categories?.length ?? 0}
              />
              <ImportStat
                label="Accounts"
                value={pendingImport.data.accounts?.length ?? 0}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingImport(null);
                  setImportError(null);
                }}
                disabled={importing}
                className="flex-1 rounded-full border border-[var(--color-line)] py-2.5 text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 rounded-full bg-[var(--color-ink)] py-2.5 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
              >
                {importing ? "Importing…" : "Replace & import"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AskTiffinSheet open={askOpen} onClose={() => setAskOpen(false)} />

      {importError && !pendingImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-[22px] bg-[var(--color-surface)] p-5">
            <h3 className="text-lg font-medium">Couldn't import</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-3)]">
              {importError}
            </p>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="mt-4 w-full rounded-full bg-[var(--color-ink)] py-2.5 text-sm font-medium text-[var(--color-bg)]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ImportShape {
  version?: number;
  exportedAt?: string;
  accounts?: Account[];
  cards?: Card[];
  categories?: Category[];
  budgets?: Budget[];
  transactions?: Transaction[];
  recurrences?: import("@/lib/types").Recurrence[];
  settings?: Settings[];
}

function ImportStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[14px] bg-[var(--color-surface-2)] p-2 text-center">
      <div className="font-display text-lg tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
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
