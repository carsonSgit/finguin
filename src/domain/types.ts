import { z } from "zod";
import type { Plan } from "../model";

export const expenseCategories = [
  "Groceries",
  "Dining",
  "Convenience",
  "Transport",
  "Shopping",
  "Health",
  "Personal care",
  "Subscriptions",
  "Entertainment",
  "Education",
  "Cannabis & vape",
  "People",
  "Fees & tax",
  "Uncategorized",
] as const;
export const incomeCategories = ["Salary", "Interest", "Dividends", "Rewards", "E-transfers in"] as const;
export const transferCategories = ["Savings", "Card payment", "Between accounts", "From other bank"] as const;
export const accountTypes = ["Chequing", "TFSA", "FHSA", "RRSP"] as const;
export const cadences = ["weekly", "biweekly", "monthly"] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type IncomeCategory = (typeof incomeCategories)[number];
export type TransferCategory = (typeof transferCategories)[number];
export type AccountType = (typeof accountTypes)[number];
export type Cadence = (typeof cadences)[number];

export const classificationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("expense"), category: z.enum(expenseCategories) }),
  z.object({ kind: z.literal("income"), category: z.enum(incomeCategories) }),
  z.object({ kind: z.literal("transfer"), category: z.enum(transferCategories) }),
]);
export type Classification = z.infer<typeof classificationSchema>;
export type Kind = Classification["kind"];
export type Category = Classification["category"];

export const accountIdSchema = z.string().min(1).brand<"AccountId">();
export const transactionIdSchema = z.string().min(1).brand<"TransactionId">();
export type AccountId = z.infer<typeof accountIdSchema>;
export type TransactionId = z.infer<typeof transactionIdSchema>;
export const isoDateSchema = z.iso.date();

export interface Account {
  readonly id: AccountId;
  readonly institution: "Wealthsimple";
  readonly type: AccountType;
  readonly name: string;
  readonly number: string;
  /** Fraction of the balance set aside for the home goal, 0–1. */
  readonly homeShare: number;
}

export interface Transaction {
  readonly id: TransactionId;
  readonly accountId: AccountId;
  readonly date: string;
  readonly time: string;
  /** Signed cents: negative leaves the account. */
  readonly amount: number;
  readonly payee: string;
  readonly merchant: string;
  readonly classification: Classification;
  readonly counterpartyAccountId: AccountId | null;
  readonly reviewed: boolean;
}

export interface Trade {
  readonly id: string;
  readonly accountId: AccountId;
  readonly date: string;
  readonly side: "buy" | "sell";
  readonly symbol: string;
  readonly securityName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  /** Signed cents of cash the trade moved. */
  readonly netCash: number;
}

export interface Holding {
  readonly accountId: AccountId;
  readonly symbol: string;
  readonly securityName: string;
  readonly quantity: number;
  readonly lastPrice: number;
  readonly lastPriceDate: string;
  /** Cents at the last traded price. */
  readonly value: number;
}

export interface AccountSummary extends Account {
  readonly cash: number;
  readonly invested: number;
  readonly balance: number;
  /** True when the export starts after the account opened, so the balance is partial. */
  readonly partialHistory: boolean;
}

export interface RecurringSeries {
  readonly key: string;
  readonly accountId: AccountId;
  readonly merchant: string;
  readonly classification: Classification;
  readonly cadence: Cadence;
  /** Median signed cents per occurrence. */
  readonly amount: number;
  readonly transactionIds: readonly TransactionId[];
  readonly lastDate: string;
  readonly nextDate: string;
}

export interface ImportRecord {
  readonly id: number;
  readonly fileName: string;
  readonly format: "chequing" | "activities";
  readonly importedAt: string;
  readonly rowsRead: number;
  readonly rowsAdded: number;
}

export interface Snapshot {
  readonly accounts: readonly AccountSummary[];
  readonly transactions: readonly Transaction[];
  readonly trades: readonly Trade[];
  readonly holdings: readonly Holding[];
  readonly recurring: readonly RecurringSeries[];
  readonly imports: readonly ImportRecord[];
  readonly plan: Plan;
}
