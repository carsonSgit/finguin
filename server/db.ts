import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { holdings, summarizeAccounts } from "../src/domain/analytics";
import { detectRecurring } from "../src/domain/recurring";
import { linkTransfers } from "../src/domain/transfers";
import {
  type Account,
  accountIdSchema,
  accountTypes,
  type Classification,
  classificationSchema,
  type ImportRecord,
  type Snapshot,
  type Trade,
  type Transaction,
  type TransactionId,
  transactionIdSchema,
} from "../src/domain/types";
import type { ParsedImport } from "../src/import/wealthsimple";
import { defaultPlan, type Plan, planSchema } from "../src/model";

const schema = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  institution TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (${accountTypes.map((t) => `'${t}'`).join(",")})),
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  home_share REAL NOT NULL CHECK (home_share BETWEEN 0 AND 1)
) STRICT;
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payee TEXT NOT NULL,
  merchant TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income','transfer')),
  category TEXT NOT NULL,
  counterparty_account_id TEXT REFERENCES accounts(id),
  reviewed INTEGER NOT NULL CHECK (reviewed IN (0,1)),
  classified_by TEXT NOT NULL CHECK (classified_by IN ('rules','user'))
) STRICT;
CREATE INDEX IF NOT EXISTS transactions_date ON transactions(date);
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  symbol TEXT NOT NULL,
  security_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  net_cash INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('chequing','activities')),
  imported_at TEXT NOT NULL,
  rows_read INTEGER NOT NULL,
  rows_added INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
`;

export function openDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(schema);
  return db;
}

const accountRow = z.object({
  id: accountIdSchema,
  institution: z.literal("Wealthsimple"),
  type: z.enum(accountTypes),
  number: z.string(),
  name: z.string(),
  home_share: z.number(),
});
const transactionRow = z.object({
  id: transactionIdSchema,
  account_id: accountIdSchema,
  date: z.string(),
  time: z.string(),
  amount: z.number().int(),
  payee: z.string(),
  merchant: z.string(),
  kind: z.string(),
  category: z.string(),
  counterparty_account_id: accountIdSchema.nullable(),
  reviewed: z.union([z.literal(0), z.literal(1)]),
});
const tradeRow = z.object({
  id: z.string(),
  account_id: accountIdSchema,
  date: z.string(),
  side: z.enum(["buy", "sell"]),
  symbol: z.string(),
  security_name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  net_cash: z.number().int(),
});
const importRow = z.object({
  id: z.number(),
  file_name: z.string(),
  format: z.enum(["chequing", "activities"]),
  imported_at: z.string(),
  rows_read: z.number(),
  rows_added: z.number(),
});

export function readAccounts(db: Database): Account[] {
  return z
    .array(accountRow)
    .parse(db.query("SELECT * FROM accounts ORDER BY type, number").all())
    .map((r) => ({ id: r.id, institution: r.institution, type: r.type, number: r.number, name: r.name, homeShare: r.home_share }));
}

function rowToTransaction(r: z.infer<typeof transactionRow>): Transaction {
  return {
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    time: r.time,
    amount: r.amount,
    payee: r.payee,
    merchant: r.merchant,
    classification: classificationSchema.parse({ kind: r.kind, category: r.category }),
    counterpartyAccountId: r.counterparty_account_id,
    reviewed: r.reviewed === 1,
  };
}
function readTransactions(db: Database): Transaction[] {
  return z
    .array(transactionRow)
    .parse(db.query("SELECT * FROM transactions ORDER BY date DESC, time DESC").all())
    .map(rowToTransaction);
}

function readTrades(db: Database): Trade[] {
  return z
    .array(tradeRow)
    .parse(db.query("SELECT * FROM trades ORDER BY date").all())
    .map((r) => ({
      id: r.id,
      accountId: r.account_id,
      date: r.date,
      side: r.side,
      symbol: r.symbol,
      securityName: r.security_name,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      netCash: r.net_cash,
    }));
}
function readImports(db: Database): ImportRecord[] {
  return z
    .array(importRow)
    .parse(db.query("SELECT * FROM imports ORDER BY id DESC").all())
    .map((r) => ({
      id: r.id,
      fileName: r.file_name,
      format: r.format,
      importedAt: r.imported_at,
      rowsRead: r.rows_read,
      rowsAdded: r.rows_added,
    }));
}
function readPlan(db: Database): Plan {
  const row = db.query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?").get("plan");
  return row ? planSchema.parse(JSON.parse(row.value)) : defaultPlan;
}

export function snapshot(db: Database): Snapshot {
  const accounts = readAccounts(db);
  const transactions = readTransactions(db);
  const trades = readTrades(db);
  const positions = holdings(trades);
  return {
    accounts: summarizeAccounts(accounts, transactions, trades, positions),
    transactions,
    trades,
    holdings: positions.filter((p) => p.quantity > 1e-6),
    recurring: detectRecurring(transactions),
    imports: readImports(db),
    plan: readPlan(db),
  };
}

/** Idempotent: re-importing the same export adds nothing and re-applies rules to rows the user hasn't edited. */
export function importParsed(db: Database, parsed: ParsedImport, fileName: string) {
  return db.transaction(() => {
    const insertAccount = db.query(
      `INSERT INTO accounts (id, institution, type, number, name, home_share)
       VALUES ($id, $institution, $type, $number, $name, $homeShare) ON CONFLICT(id) DO NOTHING`,
    );
    for (const a of parsed.accounts)
      insertAccount.run({ id: a.id, institution: a.institution, type: a.type, number: a.number, name: a.name, homeShare: a.homeShare });
    const before = db.query<{ n: number }, []>("SELECT (SELECT count(*) FROM transactions) + (SELECT count(*) FROM trades) AS n").get()?.n ?? 0;
    const upsertTransaction = db.query(
      `INSERT INTO transactions (id, account_id, date, time, amount, payee, merchant, kind, category, counterparty_account_id, reviewed, classified_by)
       VALUES ($id, $accountId, $date, $time, $amount, $payee, $merchant, $kind, $category, NULL, $reviewed, 'rules')
       ON CONFLICT(id) DO UPDATE SET payee = CASE WHEN excluded.payee <> '' THEN excluded.payee ELSE transactions.payee END,
         merchant = excluded.merchant, kind = excluded.kind,
         category = excluded.category, reviewed = excluded.reviewed
       WHERE transactions.classified_by = 'rules'`,
    );
    // Same account, date, time and amount with exactly one side missing its payee: the same row
    // re-exported after Wealthsimple backfilled the payee. Update the existing row, never duplicate it.
    const twin = db.query(
      `SELECT id, payee FROM transactions
       WHERE account_id = ? AND date = ? AND time = ? AND amount = ?
         AND ((payee = '' AND ? <> '') OR (payee <> '' AND ? = ''))`,
    );
    for (const t of parsed.transactions) {
      const existing = z
        .object({ id: z.string(), payee: z.string() })
        .nullable()
        .parse(twin.get(t.accountId, t.date, t.time, t.amount, t.payee, t.payee));
      const id = existing?.id ?? t.id;
      if (existing && existing.payee !== "") continue; // the stored row already has the payee; keep it as is
      upsertTransaction.run({
        id,
        accountId: t.accountId,
        date: t.date,
        time: t.time,
        amount: t.amount,
        payee: t.payee,
        merchant: t.merchant,
        kind: t.classification.kind,
        category: t.classification.category,
        reviewed: t.reviewed ? 1 : 0,
      });
    }
    const insertTrade = db.query(
      `INSERT INTO trades (id, account_id, date, side, symbol, security_name, quantity, unit_price, net_cash)
       VALUES ($id, $accountId, $date, $side, $symbol, $securityName, $quantity, $unitPrice, $netCash) ON CONFLICT(id) DO NOTHING`,
    );
    for (const t of parsed.trades) insertTrade.run({ ...t });
    const after = db.query<{ n: number }, []>("SELECT (SELECT count(*) FROM transactions) + (SELECT count(*) FROM trades) AS n").get()?.n ?? 0;
    dedupeBackfilled(db);
    relinkTransfers(db);
    db.query(
      "INSERT INTO imports (file_name, format, imported_at, rows_read, rows_added) VALUES (?, ?, ?, ?, ?)",
    ).run(fileName, parsed.format, new Date().toISOString(), parsed.rowsRead, after - before);
    return { added: after - before, read: parsed.rowsRead, skipped: parsed.skipped };
  })();
}

/** Removes blank-payee rows whose payee-backfilled twin exists: same account, date, time and amount. */
function dedupeBackfilled(db: Database) {
  db.query(
    `DELETE FROM transactions WHERE payee = '' AND EXISTS (
       SELECT 1 FROM transactions p
       WHERE p.account_id = transactions.account_id AND p.date = transactions.date
         AND p.time = transactions.time AND p.amount = transactions.amount AND p.payee <> '')`,
  ).run();
}

function relinkTransfers(db: Database) {
  const links = linkTransfers(readTransactions(db));
  db.exec("UPDATE transactions SET counterparty_account_id = NULL");
  const set = db.query("UPDATE transactions SET counterparty_account_id = ? WHERE id = ?");
  for (const [id, counterparty] of links) set.run(counterparty, id);
}

export function reclassify(db: Database, id: TransactionId, classification: Classification) {
  const result = db
    .query("UPDATE transactions SET kind = ?, category = ?, reviewed = 1, classified_by = 'user' WHERE id = ?")
    .run(classification.kind, classification.category, id);
  if (result.changes !== 1) throw new Error(`No transaction ${id}`);
  relinkTransfers(db);
}

export function setHomeShare(db: Database, id: Account["id"], homeShare: number) {
  db.query("UPDATE accounts SET home_share = ? WHERE id = ?").run(homeShare, id);
}

export function savePlan(db: Database, plan: Plan) {
  db.query("INSERT INTO settings (key, value) VALUES ('plan', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify(plan),
  );
}
