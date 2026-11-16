import { describe, expect, test } from "bun:test";
import {
  addDays,
  allocation,
  categoryTrends,
  contributionRoom,
  forecast,
  investmentPerformance,
  monthlyFlows,
  requiredMonthly,
  topMerchants,
  yearSummary,
} from "../src/domain/insights";
import { projection } from "../src/domain/plan";
import {
  accountIdSchema,
  type Classification,
  type RecurringSeries,
  type Trade,
  type Transaction,
  transactionIdSchema,
} from "../src/domain/types";
import { defaultPlan } from "../src/model";

const chequing = accountIdSchema.parse("DEMO-CHEQUING-0001");
const fhsa = accountIdSchema.parse("DEMO-FHSA-0002CAD");
let seq = 0;
const tx = (patch: Partial<Omit<Transaction, "id">> & { id?: string }): Transaction => ({
  accountId: chequing,
  date: "2026-10-01",
  time: "12:00:00",
  amount: -1000,
  payee: "Test",
  merchant: "Test",
  classification: { kind: "expense", category: "Groceries" },
  counterpartyAccountId: null,
  reviewed: true,
  ...patch,
  id: transactionIdSchema.parse(patch.id ?? `t${seq++}`),
});
const salary: Classification = { kind: "income", category: "Salary" };
const series = (patch: Partial<RecurringSeries>): RecurringSeries => ({
  key: `expense|Netflix|${chequing}|`,
  accountId: chequing,
  merchant: "Netflix",
  classification: { kind: "expense", category: "Subscriptions" },
  cadence: "monthly",
  amount: -1599,
  transactionIds: [],
  lastDate: "2026-11-01",
  nextDate: "2026-12-01",
  ...patch,
});
const trade = (patch: Partial<Trade>): Trade => ({
  id: `tr${seq++}`,
  accountId: fhsa,
  date: "2026-10-01",
  side: "buy",
  symbol: "VFV",
  securityName: "Vanguard S&P 500 Index ETF",
  quantity: 1,
  unitPrice: 100,
  netCash: -10000,
  ...patch,
});

describe("monthlyFlows", () => {
  test("groups cashflow per month, oldest first", () => {
    const flows = monthlyFlows(
      [
        tx({ date: "2026-09-05", amount: 500000, classification: salary }),
        tx({ date: "2026-09-06", amount: -100000 }),
        tx({ date: "2026-10-05", amount: 500000, classification: salary }),
        tx({ date: "2026-10-06", amount: -250000, classification: { kind: "expense", category: "Dining" } }),
      ],
      6,
    );
    expect(flows.map((f) => [f.month, f.income, f.spending, f.saved, f.rate])).toEqual([
      ["2026-09", 500000, 100000, 400000, 80],
      ["2026-10", 500000, 250000, 250000, 50],
    ]);
  });
});

describe("categoryTrends", () => {
  test("ranks biggest movers between the last two months", () => {
    const trends = categoryTrends(
      [
        tx({
          date: "2026-10-01",
          amount: -10000,
          classification: { kind: "expense", category: "Groceries" },
        }),
        tx({
          date: "2026-11-01",
          amount: -30000,
          classification: { kind: "expense", category: "Groceries" },
        }),
        tx({ date: "2026-10-01", amount: -20000, classification: { kind: "expense", category: "Dining" } }),
        tx({ date: "2026-11-01", amount: -5000, classification: { kind: "expense", category: "Dining" } }),
      ],
      6,
    );
    expect(trends.map((t) => [t.category, t.current, t.previous, t.delta, t.pct])).toEqual([
      ["Groceries", 30000, 10000, 20000, 200],
      ["Dining", 5000, 20000, -15000, -75],
    ]);
  });
});

describe("topMerchants and yearSummary", () => {
  test("sums expense merchants since a date and builds a year summary", () => {
    const rows = [
      tx({ date: "2026-10-01", merchant: "IGA", amount: -5000 }),
      tx({ date: "2026-11-02", merchant: "IGA", amount: -7000 }),
      tx({
        date: "2026-11-03",
        merchant: "Uber",
        amount: -3000,
        classification: { kind: "expense", category: "Transport" },
      }),
      tx({ date: "2026-11-04", amount: 500000, classification: salary }),
      tx({
        date: "2026-11-05",
        amount: 500,
        classification: { kind: "income", category: "Dividends" },
      }),
      tx({ date: "2025-12-01", merchant: "IGA", amount: -99999 }),
    ];
    expect(topMerchants(rows, "2026-10-01", 5).map((m) => [m.merchant, m.value, m.count])).toEqual([
      ["IGA", 12000, 2],
      ["Uber", 3000, 1],
    ]);
    const summary = yearSummary(rows, 2026);
    expect(summary.income).toBe(500500);
    expect(summary.spending).toBe(15000);
    expect(summary.dividends).toBe(500);
    expect(summary.byCategory[0]).toMatchObject({ name: "Groceries", value: 12000 });
    expect(summary.merchants[0]?.merchant).toBe("IGA");
  });
});

describe("forecast", () => {
  test("projects recurring amounts month by month and derives safe-to-spend", () => {
    const result = forecast(
      [
        series({ amount: -1599, nextDate: "2026-11-20", cadence: "monthly" }),
        series({
          key: "income|Example Employer|x|",
          merchant: "Example Employer",
          classification: salary,
          amount: 500000,
          nextDate: "2026-11-15",
          cadence: "biweekly",
        }),
      ],
      100000,
      "2026-11-10",
      3,
    );
    // safe to spend = cash - the Netflix charge due within 30 days
    expect(result.safeToSpend).toBe(100000 - 1599);
    // november: 2 paycheques + 1 netflix charge; december: 2 paycheques + netflix; january: 2 paycheques + netflix
    const byMonth = Object.fromEntries(result.points.map((p) => [p.month, p.cents]));
    expect(byMonth["2026-11"]).toBe(100000 + 2 * 500000 - 1599);
    expect(byMonth["2026-12"]).toBe(100000 + 4 * 500000 - 2 * 1599);
    expect(byMonth["2027-01"]).toBe(100000 + 6 * 500000 - 3 * 1599);
  });
  test("addDays rolls over month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("investmentPerformance and allocation", () => {
  test("nets buys and sells into cost basis and unrealized gain", () => {
    const trades = [
      trade({ netCash: -10000, quantity: 1, unitPrice: 100 }),
      trade({ date: "2026-11-01", side: "buy", netCash: -11000, quantity: 1, unitPrice: 110 }),
    ];
    const positions = investmentPerformance(
      [
        {
          accountId: fhsa,
          symbol: "VFV",
          securityName: "Vanguard S&P 500 Index ETF",
          quantity: 2,
          lastPrice: 120,
          lastPriceDate: "2026-11-02",
          value: 24000,
        },
      ],
      trades,
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ cost: 21000, unrealized: 3000, returnPct: (3000 / 21000) * 100 });
    expect(allocation(positions)).toEqual([{ name: "Equities", value: 24000 }]);
  });
});

describe("contributionRoom", () => {
  test("counts only external Savings contributions in the year against the limit", () => {
    const rows = [
      tx({
        accountId: fhsa,
        date: "2026-01-15",
        amount: 300000,
        classification: { kind: "transfer", category: "Savings" },
      }),
      tx({
        accountId: fhsa,
        date: "2026-06-15",
        amount: 200000,
        classification: { kind: "transfer", category: "Savings" },
      }),
      tx({
        accountId: fhsa,
        date: "2026-07-01",
        amount: 50000,
        classification: { kind: "transfer", category: "Between accounts" },
      }),
      tx({
        accountId: fhsa,
        date: "2025-12-01",
        amount: 800000,
        classification: { kind: "transfer", category: "Savings" },
      }),
    ];
    expect(contributionRoom(rows, fhsa, 2026, 800000)).toEqual({
      contributed: 500000,
      room: 300000,
      annualLimit: 800000,
    });
  });
});

describe("requiredMonthly", () => {
  test("round-trips with projection: saving that amount reaches the target on time", () => {
    const plan = { ...defaultPlan, monthly: 2200, annualReturn: 3 };
    const saved = 100000;
    for (const months of [12, 24, 36]) {
      const monthly = requiredMonthly(saved, plan, months);
      const reached = projection(saved, { ...plan, monthly }).months;
      expect(reached).not.toBeNull();
      expect(reached as number).toBeLessThanOrEqual(months);
    }
  });
  test("is zero when already funded", () => {
    expect(requiredMonthly(10_000_000, defaultPlan, 12)).toBe(0);
  });
});
