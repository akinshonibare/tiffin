export type AccountType = "chequing" | "savings" | "credit" | "cash" | "other";

export interface Account {
  id: string;
  name: string;
  bank: string;
  type: AccountType;
  color: string;
  last4?: string;
  archived?: boolean;
  createdAt: number;
}

export interface Card {
  id: string;
  accountId: string;
  nickname: string;
  last4?: string;
  color: string;
  archived?: boolean;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  archived?: boolean;
  createdAt: number;
}

export type BudgetPeriod = "monthly" | "biweekly";

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  anchorDate: string;
  rollover?: boolean;
  createdAt: number;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
  tags?: string[];
  isRefund?: boolean;
  recurrenceId?: string;
  createdAt: number;
}

export type RecurrencePeriod = "weekly" | "biweekly" | "monthly";

export interface Recurrence {
  id: string;
  name: string;
  amount: number;
  period: RecurrencePeriod;
  nextDue: string;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
  tags?: string[];
  active: boolean;
  createdAt: number;
}

export type BackupCadence = "off" | "biweekly" | "monthly";

export interface Settings {
  id: "singleton";
  theme: "light" | "dark" | "system";
  currency: "CAD";
  biweeklyAnchor?: string;
  overallMonthly?: number;
  backupCadence?: BackupCadence;
  lastExportAt?: string;
  seeded?: boolean;
}
