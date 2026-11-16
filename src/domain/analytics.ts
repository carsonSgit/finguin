import type { Account, AccountSummary, ExpenseCategory, Holding, Trade, Transaction } from "./types";

type ExpenseTransaction = Transaction & {
  readonly classification: { kind: "expense"; category: ExpenseCategory };
};

export function cashflow(transactions: readonly Transaction[]) {
  let income = 0;
  let spending = 0;
  for (const t of transactions) {
    switch (t.classification.kind) {
      case "income":
        income += t.amount;
        break;
      case "expense":
        spending -= t.amount;
        break;
      case "transfer":
        break;
      default: {
        const exhaustive: never = t.classification;
        return exhaustive;
      }
    }
  }
  return {
    income,
    spending,
    saved: income - spending,
    rate: income > 0 ? ((income - spending) / income) * 100 : null,
  };
}

function sumExpenses<K extends string>(
  transactions: readonly Transaction[],
  key: (t: ExpenseTransaction) => K,
) {
  const totals = new Map<K, { name: K; value: number; count: number }>();
  for (const t of transactions) {
    if (t.classification.kind !== "expense") continue;
    const name = key({ ...t, classification: t.classification });
    const entry = totals.get(name) ?? { name, value: 0, count: 0 };
    totals.set(name, { name, value: entry.value - t.amount, count: entry.count + 1 });
  }
  return [...totals.values()].filter((g) => g.value > 0).sort((a, b) => b.value - a.value);
}

export const spendingByCategory = (transactions: readonly Transaction[]) =>
  sumExpenses(transactions, (t) => t.classification.category);

export function holdings(trades: readonly Trade[]): Holding[] {
  const lastPrice = new Map<string, Trade>();
  for (const t of trades.toSorted((a, b) => a.date.localeCompare(b.date))) lastPrice.set(t.symbol, t);
  const positions = Map.groupBy(trades, (t) => `${t.accountId}|${t.symbol}`);
  return [...positions.values()].flatMap((rows) => {
    const first = rows[0];
    const price = first && lastPrice.get(first.symbol);
    if (!first || !price) return [];
    const quantity = rows.reduce((q, t) => q + (t.side === "buy" ? t.quantity : -t.quantity), 0);
    return [
      {
        accountId: first.accountId,
        symbol: first.symbol,
        securityName: first.securityName,
        quantity,
        lastPrice: price.unitPrice,
        lastPriceDate: price.date,
        value: Math.round(quantity * price.unitPrice * 100),
      },
    ];
  });
}

export function summarizeAccounts(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  trades: readonly Trade[],
  positions: readonly Holding[],
): AccountSummary[] {
  return accounts.map((a) => {
    const cash =
      transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0) +
      trades.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.netCash, 0);
    const mine = positions.filter((p) => p.accountId === a.id);
    const invested = mine.filter((p) => p.quantity > 1e-6).reduce((s, p) => s + p.value, 0);
    return {
      ...a,
      cash,
      invested,
      balance: Math.max(cash, 0) + invested,
      partialHistory: cash < 0 || mine.some((p) => p.quantity < -1e-6),
    };
  });
}

export function netWorthHistory(total: number, transactions: readonly Transaction[]) {
  const byMonth = Map.groupBy(transactions, (t) => t.date.slice(0, 7));
  let value = total;
  const points: { month: string; value: number }[] = [];
  for (const month of [...byMonth.keys()].sort().reverse()) {
    points.unshift({ month, value });
    value -= cashflow(byMonth.get(month) ?? []).saved;
  }
  return points;
}
