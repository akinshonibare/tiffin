import type { Recurrence, RecurrencePeriod } from "./types";

export function advanceDate(iso: string, period: RecurrencePeriod): string {
  const d = new Date(iso + "T00:00:00");
  if (period === "weekly") d.setDate(d.getDate() + 7);
  else if (period === "biweekly") d.setDate(d.getDate() + 14);
  else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export function isDue(rec: Recurrence, today = new Date()): boolean {
  if (!rec.active) return false;
  const t = today.toISOString().slice(0, 10);
  return rec.nextDue <= t;
}

export function periodLabel(p: RecurrencePeriod): string {
  return p === "weekly" ? "Weekly" : p === "biweekly" ? "Biweekly" : "Monthly";
}
