import type { Plan } from "../model";
import { cashflow, spendingByCategory } from "./analytics";
import { homeTarget } from "./plan";
import type { AccountId, Cadence, Holding, RecurringSeries, Trade, Transaction } from "./types";

export interface MonthFlow {
  readonly month: string;
  readonly income: number;
  readonly spending: number;
  readonly saved: number;
  readonly rate: number | null;
}

/** Per-month income/spending/savings, oldest first, capped at `count` recent months. */
export function monthlyFlows(transactions: readonly Transaction[], count: number): MonthFlow[] {
  const byMonth = Map.groupBy(transactions, (t) => t.date.slice(0, 7));
  const months = [...byMonth.keys()].sort().slice(-count);
  return months.map((month) => ({ month, ...cashflow(byMonth.get(month) ?? []) }));
}

export interface CategoryTrend {
  readonly category: string;
  /** Spending per month, aligned with the returned months (0 when absent). */
  readonly values: readonly number[];
  readonly months: readonly string[];
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  /** Change vs the previous month, or null when there was no previous spending. */
  readonly pct: number | null;
}

/** Biggest category movers between the two most recent months with data. */
export function categoryTrends(transactions: readonly Transaction[], count = 6, top = 6): CategoryTrend[] {
  const flows = monthlyFlows(transactions, count);
  const months = flows.map((f) => f.month);
  const perCategory = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    if (t.classification.kind !== "expense") continue;
    const month = t.date.slice(0, 7);
    if (!months.includes(month)) continue;
    const byMonth = perCategory.get(t.classification.category) ?? new Map<string, number>();
    byMonth.set(month, (byMonth.get(month) ?? 0) - t.amount);
    perCategory.set(t.classification.category, byMonth);
  }
  return [...perCategory.entries()]
    .map(([category, byMonth]) => {
      const values = months.map((m) => byMonth.get(m) ?? 0);
      const current = values.at(-1) ?? 0;
      const previous = values.at(-2) ?? 0;
      const delta = current - previous;
      return {
        category,
        values,
        months,
        current,
        previous,
        delta,
        pct: previous > 0 ? (delta / previous) * 100 : null,
      };
    })
    .filter((c) => c.values.some((v) => v > 0))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, top);
}

export interface MerchantTotal {
  readonly merchant: string;
  readonly category: string;
  readonly value: number;
  readonly count: number;
}

/** Biggest expense merchants since a YYYY-MM-DD date. */
export function topMerchants(
  transactions: readonly Transaction[],
  since: string,
  limit = 8,
): MerchantTotal[] {
  const totals = new Map<string, { merchant: string; category: string; value: number; count: number }>();
  for (const t of transactions) {
    if (t.classification.kind !== "expense" || t.date < since) continue;
    const entry = totals.get(t.merchant) ?? {
      merchant: t.merchant,
      category: t.classification.category,
      value: 0,
      count: 0,
    };
    entry.value += -t.amount;
    entry.count += 1;
    totals.set(t.merchant, entry);
  }
  return [...totals.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

const periodDays: Record<Cadence, number> = { weekly: 7, biweekly: 14, monthly: 30.4 };

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + Math.round(days));
  return d.toLocaleDateString("en-CA");
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export interface Forecast {
  /** Projected total cash at the end of each of the next `months` months, cents. */
  readonly points: readonly { readonly month: string; readonly cents: number }[];
  /** Cash minus recurring expenses due within 30 days: what is safe to spend now. */
  readonly safeToSpend: number;
}

/** Projects cash forward from detected recurring series (bills, subscriptions, paycheques). */
export function forecast(
  recurring: readonly RecurringSeries[],
  cashCents: number,
  today: string,
  months = 6,
): Forecast {
  const horizonEnd = addDays(today, months * 31 + 31);
  const perMonth = new Map<string, number>();
  for (const r of recurring) {
    let date = r.nextDate;
    while (date <= horizonEnd) {
      const key = date.slice(0, 7);
      perMonth.set(key, (perMonth.get(key) ?? 0) + r.amount);
      date = addDays(date, periodDays[r.cadence]);
    }
  }
  const soonEnd = addDays(today, 30);
  const upcomingExpenses = recurring
    .filter((r) => r.amount < 0 && r.nextDate <= soonEnd)
    .reduce((s, r) => s + r.amount, 0);
  const base = new Date(`${today.slice(0, 7)}-01T12:00:00`);
  const points = [0, ...Array.from({ length: months }, (_, i) => i + 1)].map((offset) => {
    const d = new Date(base);
    d.setMonth(d.getMonth() + offset);
    return monthKey(d);
  });
  let cents = cashCents;
  const series = points.map((month) => {
    cents += perMonth.get(month) ?? 0;
    return { month, cents };
  });
  return { points: series, safeToSpend: cashCents + upcomingExpenses };
}

export interface YearSummary {
  readonly income: number;
  readonly spending: number;
  readonly saved: number;
  readonly rate: number | null;
  readonly dividends: number;
  readonly byCategory: ReturnType<typeof spendingByCategory>;
  readonly merchants: readonly MerchantTotal[];
}

export function yearSummary(transactions: readonly Transaction[], year: number): YearSummary {
  const rows = transactions.filter((t) => t.date.startsWith(String(year)));
  const flow = cashflow(rows);
  const dividends = rows
    .filter((t) => t.classification.kind === "income" && t.classification.category === "Dividends")
    .reduce((s, t) => s + t.amount, 0);
  return {
    ...flow,
    dividends,
    byCategory: spendingByCategory(rows),
    merchants: topMerchants(rows, `${year}-01-01`, 5),
  };
}

export interface Position extends Holding {
  /** What the trades paid for the position, cents (sells reduce it). */
  readonly cost: number;
  /** Average cost per share, cents. */
  readonly avgCost: number;
  readonly unrealized: number;
  readonly returnPct: number | null;
}

/** Holdings joined with their cost basis from the trade history. */
export function investmentPerformance(holdings: readonly Holding[], trades: readonly Trade[]): Position[] {
  const byKey = Map.groupBy(trades, (t) => `${t.accountId}|${t.symbol}`);
  return holdings
    .filter((h) => h.quantity > 1e-6)
    .map((h) => {
      const rows = byKey.get(`${h.accountId}|${h.symbol}`) ?? [];
      const cost = -rows.reduce((s, t) => s + t.netCash, 0);
      const unrealized = h.value - cost;
      return {
        ...h,
        cost,
        avgCost: h.quantity > 0 ? cost / h.quantity : 0,
        unrealized,
        returnPct: cost > 0 ? (unrealized / cost) * 100 : null,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function allocation(positions: readonly Holding[]) {
  const classOf = (name: string) =>
    /bond/i.test(name) ? "Bonds" : /cash|money market/i.test(name) ? "Cash" : "Equities";
  const totals = new Map<string, number>();
  for (const h of positions.filter((p) => p.quantity > 1e-6))
    totals.set(classOf(h.securityName), (totals.get(classOf(h.securityName)) ?? 0) + h.value);
  return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/**
 * Contribution room left in a registered account for a calendar year, counting only
 * external contributions (EFT "Savings" money in) — in-account transfers don't consume room.
 */
export function contributionRoom(
  transactions: readonly Transaction[],
  accountId: AccountId,
  year: number,
  annualLimit = 800000,
) {
  const contributed = transactions
    .filter(
      (t) =>
        t.accountId === accountId &&
        t.amount > 0 &&
        t.date.startsWith(String(year)) &&
        t.classification.kind === "transfer" &&
        t.classification.category === "Savings",
    )
    .reduce((s, t) => s + t.amount, 0);
  return { contributed, room: Math.max(0, annualLimit - contributed), annualLimit };
}

/** Monthly contribution (dollars) needed to reach the home target in exactly `months` months. */
export function requiredMonthly(saved: number, plan: Plan, months: number) {
  const r = (1 + plan.annualReturn / 100) ** (1 / 12) - 1;
  const growth = (1 + r) ** months;
  const need = homeTarget(plan) - saved * growth;
  if (need <= 0) return 0;
  const annuity = r === 0 ? months : (growth - 1) / r;
  return Math.ceil((need / annuity) * 100) / 100;
}
