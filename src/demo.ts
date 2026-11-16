import { z } from "zod";
import { holdings, summarizeAccounts } from "./domain/analytics";
import { detectRecurring } from "./domain/recurring";
import { linkTransfers } from "./domain/transfers";
import {
  type Account,
  accountIdSchema,
  type Classification,
  classificationSchema,
  type Snapshot,
  type Trade,
  type Transaction,
  transactionIdSchema,
} from "./domain/types";
import { defaultPlan, planSchema } from "./model";

export function createDemo(now = new Date()) {
  let accounts: Account[] = (["Chequing", "FHSA", "TFSA", "RRSP"] as const).map((type, i) => ({
    id: accountIdSchema.parse(`DEMO-${type.toUpperCase()}-000${i + 1}`),
    institution: "Wealthsimple",
    type,
    name: `${type} ··000${i + 1}`,
    number: `DEMO-000${i + 1}`,
    homeShare: type === "FHSA" ? 1 : type === "TFSA" ? 0.5 : 0,
  }));
  const chequing = accounts[0];
  if (!chequing) throw new Error("Demo chequing account missing");
  let transactions: Transaction[] = [];
  const trades: Trade[] = [];
  let plan = { ...defaultPlan, grossIncome: 78000, monthly: 1400 };
  const add = (
    account: Account,
    date: string,
    amount: number,
    merchant: string,
    classification: Classification,
  ) => {
    transactions.push({
      id: transactionIdSchema.parse(`demo-transaction-${transactions.length + 1}`),
      accountId: account.id,
      date,
      time: "12:00:00",
      amount,
      merchant,
      payee: merchant,
      classification,
      counterpartyAccountId: null,
      reviewed: classification.category !== "Uncategorized",
    });
  };
  for (let month = 11; month >= 0; month--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - month, 1));
    const date = (day: number) =>
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)).toISOString().slice(0, 10);
    const available = (day: number) => date(day) <= now.toISOString().slice(0, 10);
    if (month === 11) {
      for (const account of accounts) {
        add(account, date(1), account.type === "Chequing" ? 1200000 : 600000, "Demo opening balance", {
          kind: "transfer",
          category: "From other bank",
        });
      }
    }
    for (const day of [1, 15]) {
      if (available(day))
        add(chequing, date(day), 245000, "Example Studio", { kind: "income", category: "Salary" });
    }
    for (const [day, amount, merchant, category] of [
      [1, 155000, "Demo rent", "People"],
      [3, 6500, "Demo internet", "Subscriptions"],
      [5, 1599, "Netflix", "Subscriptions"],
      [8, 4500, "Demo gym", "Health"],
      [12, 5400, "Demo phone", "Subscriptions"],
      [20, 1200, "Spotify", "Subscriptions"],
    ] as const) {
      if (available(day)) add(chequing, date(day), -amount, merchant, { kind: "expense", category });
    }
    for (const day of [2, 9, 16, 23]) {
      if (!available(day)) continue;
      for (const [merchant, category, amount] of [
        ["IGA", "Groceries", 7400 + month * 170],
        ["Demo café", "Dining", 1800 + day * 25],
        ["Uber", "Transport", 2200 + month * 60],
      ] as const)
        add(chequing, date(day), -amount, merchant, { kind: "expense", category });
    }
    if (available(18))
      add(chequing, date(18), -6800 - month * 300, "Demo shop", { kind: "expense", category: "Shopping" });
    if (available(10))
      add(chequing, date(10), -2400, "Unknown demo merchant", { kind: "expense", category: "Uncategorized" });
    if (available(15)) {
      for (const account of accounts.filter((a) => a.type !== "Chequing")) {
        const amount = account.type === "FHSA" ? 50000 : 30000;
        add(chequing, date(15), -amount, `To ${account.type}`, { kind: "transfer", category: "Savings" });
        add(account, date(15), amount, "Demo contribution", { kind: "transfer", category: "Savings" });
        trades.push({
          id: `demo-trade-${trades.length + 1}`,
          accountId: account.id,
          date: date(15),
          side: "buy",
          symbol: account.type === "RRSP" ? "XGRO" : "VFV",
          securityName: account.type === "RRSP" ? "iShares Core Growth ETF" : "Vanguard S&P 500 Index ETF",
          quantity: 2,
          unitPrice: 100 + (11 - month) * 2,
          netCash: -(100 + (11 - month) * 2) * 200,
        });
      }
    }
  }
  function snapshot(): Snapshot {
    const links = linkTransfers(transactions);
    const linked = transactions.map((t) => ({ ...t, counterpartyAccountId: links.get(t.id) ?? null }));
    const positions = holdings(trades);
    return {
      accounts: summarizeAccounts(accounts, linked, trades, positions),
      transactions: linked.toSorted((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
      trades,
      holdings: positions,
      recurring: detectRecurring(linked),
      imports: [],
      plan,
    };
  }
  return (path: string, init?: RequestInit): Response => {
    if (path === "/api/snapshot" && !init?.method) return Response.json(snapshot());
    if (path === "/api/import")
      return Response.json(
        { error: "CSV import is available in the local app. This demo uses fictional data." },
        { status: 403 },
      );
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (path === "/api/plan" && init?.method === "PUT") {
      plan = planSchema.parse(body);
    } else if (path.startsWith("/api/transactions/") && init?.method === "PATCH") {
      const id = transactionIdSchema.parse(path.slice("/api/transactions/".length));
      const { classification } = z.object({ classification: classificationSchema }).parse(body);
      if (!transactions.some((t) => t.id === id)) return new Response(null, { status: 404 });
      transactions = transactions.map((t) => (t.id === id ? { ...t, classification, reviewed: true } : t));
    } else if (path.startsWith("/api/accounts/") && init?.method === "PATCH") {
      const id = accountIdSchema.parse(path.slice("/api/accounts/".length));
      const { homeShare } = z.object({ homeShare: z.number().min(0).max(1) }).parse(body);
      if (!accounts.some((a) => a.id === id)) return new Response(null, { status: 404 });
      accounts = accounts.map((a) => (a.id === id ? { ...a, homeShare } : a));
    } else return new Response(null, { status: 404 });
    return new Response(null, { status: 204 });
  };
}

export const demoRequest = createDemo();
