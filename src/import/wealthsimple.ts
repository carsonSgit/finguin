import { createHash } from "node:crypto";
import Papa from "papaparse";
import { z } from "zod";
import { classifyMerchant } from "../domain/merchants";
import {
  type Account,
  type AccountType,
  accountIdSchema,
  type Classification,
  type ImportRecord,
  isoDateSchema,
  type Trade,
  type Transaction,
  transactionIdSchema,
} from "../domain/types";

export class ImportError extends Error {
  override name = "ImportError";
}

export interface ParsedImport {
  readonly format: ImportRecord["format"];
  readonly accounts: readonly Account[];
  readonly transactions: readonly Transaction[];
  readonly trades: readonly Trade[];
  readonly rowsRead: number;
  readonly skipped: readonly string[];
}

const money = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .transform((v) => Math.round(Number(v) * 100));
const cad = z.literal("CAD");

const chequingRow = z.object({
  transaction_date: isoDateSchema,
  transaction_time: z.string(),
  account_number: z.string().min(1),
  account_type: z.literal("Chequing"),
  transaction_type: z.string(),
  transaction_sub_type: z.string(),
  status: z.string(),
  payee: z.string(),
  amount: money,
  currency: cad,
});
const activityRow = z.object({
  effective_date: isoDateSchema,
  effective_time: z.string(),
  account_id: z.string().min(1),
  account_type: z.enum(["TFSA", "FHSA", "RRSP"]),
  activity_type: z.string(),
  activity_sub_type: z.string(),
  description: z.string(),
  symbol: z.string(),
  name: z.string(),
  currency: cad,
  quantity: z.string(),
  unit_price: z.string(),
  net_cash_amount: money,
});
type ChequingRow = z.infer<typeof chequingRow>;
type ActivityRow = z.infer<typeof activityRow>;

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function account(rawId: string, type: AccountType): Account {
  const number = rawId.replace(/CAD$/, "");
  return {
    id: accountIdSchema.parse(rawId),
    institution: "Wealthsimple",
    type,
    number,
    name: `${type} ··${number.slice(-4)}`,
    homeShare: type === "FHSA" ? 1 : 0,
  };
}

function classifyChequing(row: ChequingRow): { merchant: string; classification: Classification } {
  const type = `${row.transaction_type}/${row.transaction_sub_type}`;
  const payee = row.payee.trim();
  if (row.transaction_type === "Spend") {
    const { merchant, category } = classifyMerchant(payee);
    return { merchant, classification: { kind: "expense", category } };
  }
  switch (type) {
    case "Prepaid Card/Purchase": {
      if (!payee)
        return { merchant: "Card purchase", classification: { kind: "expense", category: "Uncategorized" } };
      const { merchant, category } = classifyMerchant(payee);
      return { merchant, classification: { kind: "expense", category } };
    }
    case "Deposit/Aft":
      return {
        merchant: titleCase(payee),
        classification: { kind: "transfer", category: "From other bank" },
      };
    case "Deposit/E Transfer":
      return { merchant: titleCase(payee), classification: { kind: "income", category: "E-transfers in" } };
    case "Withdrawal/E Transfer":
      return { merchant: titleCase(payee), classification: { kind: "expense", category: "People" } };
    case "Withdrawal/Bill Pay":
      return /cash back|visa|mastercard|amex/i.test(payee)
        ? { merchant: payee, classification: { kind: "transfer", category: "Card payment" } }
        : { merchant: payee, classification: { kind: "expense", category: "Uncategorized" } };
    case "Internal Transfer/Source":
      return { merchant: "Transfer out", classification: { kind: "transfer", category: "Savings" } };
    case "Interest/":
      return { merchant: "Interest", classification: { kind: "income", category: "Interest" } };
    case "Promotion/Incentive Bonus":
      return { merchant: "Wealthsimple bonus", classification: { kind: "income", category: "Rewards" } };
    default:
      return { merchant: payee || type, classification: { kind: "expense", category: "Uncategorized" } };
  }
}

function classifyActivity(row: ActivityRow): { merchant: string; classification: Classification } {
  switch (`${row.activity_type}/${row.activity_sub_type}`) {
    case "MoneyMovement/EFT":
      return { merchant: "Contribution", classification: { kind: "transfer", category: "Savings" } };
    case "MoneyMovement/TRANSFER_TF":
      return {
        merchant: "Account transfer",
        classification: { kind: "transfer", category: "Between accounts" },
      };
    case "MoneyMovement/E_TRFIN":
      return {
        merchant: "Interac e-Transfer",
        classification: { kind: "transfer", category: "From other bank" },
      };
    case "Dividend/-":
      return {
        merchant: `${row.symbol} dividend`,
        classification: { kind: "income", category: "Dividends" },
      };
    case "Interest/-":
      return { merchant: "Interest", classification: { kind: "income", category: "Interest" } };
    case "Tax/NRT":
      return { merchant: "Non-resident tax", classification: { kind: "expense", category: "Fees & tax" } };
    default:
      return {
        merchant: row.description || row.activity_type,
        classification: { kind: "expense", category: "Uncategorized" },
      };
  }
}

/** Stable across re-imports: identical rows are told apart by their order within the file. */
function idFactory(format: string) {
  const seen = new Map<string, number>();
  return (line: string) => {
    const n = (seen.get(line) ?? 0) + 1;
    seen.set(line, n);
    return createHash("sha1").update(`${format}\n${line}\n${n}`).digest("hex").slice(0, 20);
  };
}

export function parseWealthsimple(text: string): ParsedImport {
  const csv = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: "greedy" });
  const headers = csv.meta.fields ?? [];
  if (csv.errors.length)
    throw new ImportError(`CSV row ${(csv.errors[0]?.row ?? 0) + 2}: ${csv.errors[0]?.message}`);
  if (headers.includes("transaction_date") && headers.includes("payee")) return parseChequing(csv.data);
  if (headers.includes("activity_type") && headers.includes("net_cash_amount"))
    return parseActivities(csv.data);
  throw new ImportError("Not a Wealthsimple chequing or activities export.");
}

function parseChequing(rows: readonly Record<string, string>[]): ParsedImport {
  const nextId = idFactory("chequing");
  const accounts = new Map<string, Account>();
  const transactions: Transaction[] = [];
  const skipped: string[] = [];
  rows.forEach((raw, i) => {
    const parsed = chequingRow.safeParse(raw);
    if (!parsed.success) {
      skipped.push(
        `Row ${i + 2}: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
      );
      return;
    }
    const row = parsed.data;
    const id = nextId(JSON.stringify(raw));
    if (row.status !== "Completed") {
      skipped.push(`Row ${i + 2}: status ${row.status}`);
      return;
    }
    const acct = accounts.get(row.account_number) ?? account(row.account_number, "Chequing");
    accounts.set(row.account_number, acct);
    const { merchant, classification } = classifyChequing(row);
    transactions.push({
      id: transactionIdSchema.parse(id),
      accountId: acct.id,
      date: row.transaction_date,
      time: row.transaction_time,
      amount: row.amount,
      payee: row.payee,
      merchant,
      classification,
      counterpartyAccountId: null,
      reviewed: classification.category !== "Uncategorized",
    });
  });
  return {
    format: "chequing",
    accounts: [...accounts.values()],
    transactions,
    trades: [],
    rowsRead: rows.length,
    skipped,
  };
}

function parseActivities(rows: readonly Record<string, string>[]): ParsedImport {
  const nextId = idFactory("activities");
  const accounts = new Map<string, Account>();
  const transactions: Transaction[] = [];
  const trades: Trade[] = [];
  const skipped: string[] = [];
  rows.forEach((raw, i) => {
    const parsed = activityRow.safeParse(raw);
    if (!parsed.success) {
      skipped.push(
        `Row ${i + 2}: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
      );
      return;
    }
    const row = parsed.data;
    const id = nextId(JSON.stringify(raw));
    const acct = accounts.get(row.account_id) ?? account(row.account_id, row.account_type);
    accounts.set(row.account_id, acct);
    if (row.activity_type === "Trade") {
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unit_price);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        skipped.push(`Row ${i + 2}: trade without quantity or price`);
        return;
      }
      trades.push({
        id,
        accountId: acct.id,
        date: row.effective_date,
        side: quantity < 0 ? "sell" : "buy",
        symbol: row.symbol,
        securityName: row.name.trim(),
        quantity: Math.abs(quantity),
        unitPrice,
        netCash: row.net_cash_amount,
      });
      return;
    }
    const { merchant, classification } = classifyActivity(row);
    transactions.push({
      id: transactionIdSchema.parse(id),
      accountId: acct.id,
      date: row.effective_date,
      time: row.effective_time,
      amount: row.net_cash_amount,
      payee: row.description,
      merchant,
      classification,
      counterpartyAccountId: null,
      reviewed: classification.category !== "Uncategorized",
    });
  });
  return {
    format: "activities",
    accounts: [...accounts.values()],
    transactions,
    trades,
    rowsRead: rows.length,
    skipped,
  };
}
