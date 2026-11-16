import { describe, expect, test } from "bun:test";
import { cashflow, holdings, netWorthHistory } from "../src/domain/analytics";
import { classifyMerchant } from "../src/domain/merchants";
import { detectRecurring } from "../src/domain/recurring";
import { linkTransfers } from "../src/domain/transfers";
import {
  type AccountId,
  accountIdSchema,
  type Classification,
  type Trade,
  type Transaction,
  transactionIdSchema,
} from "../src/domain/types";

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

describe("cashflow", () => {
  test("counts income and spending but ignores both transfer legs", () => {
    const result = cashflow([
      tx({ amount: 500000, classification: salary }),
      tx({ amount: -100000 }),
      tx({ amount: 25000 }),
      tx({ amount: -20000, classification: { kind: "transfer", category: "Savings" } }),
      tx({ amount: 20000, classification: { kind: "transfer", category: "Savings" } }),
    ]);
    expect(result).toEqual({ income: 500000, spending: 75000, saved: 425000, rate: 85 });
  });
});

describe("classifyMerchant", () => {
  test("normalizes store numbers and spelling variants into one merchant", () => {
    expect(
      ["Couchetard", "Couche-Tard", "Jean Coutu 0285", "Sqdc77021 Mtl Metro Pe"].map(classifyMerchant),
    ).toEqual([
      { merchant: "Couche-Tard", category: "Convenience" },
      { merchant: "Couche-Tard", category: "Convenience" },
      { merchant: "Jean Coutu", category: "Health" },
      { merchant: "SQDC", category: "Cannabis & vape" },
    ]);
  });
  test("separates Uber Eats from Uber rides and labels known stores", () => {
    expect(
      ["Uber Canada/Ubereats", "Uber Canada/Ubertrip", "Walmart", "Anomaly"].map(classifyMerchant),
    ).toEqual([
      { merchant: "Uber Eats", category: "Dining" },
      { merchant: "Uber", category: "Transport" },
      { merchant: "Walmart", category: "Shopping" },
      { merchant: "OpenCode", category: "Subscriptions" },
    ]);
  });
});

describe("linkTransfers", () => {
  test("pairs each same-second transfer with a distinct receiving account", () => {
    const savings: Classification = { kind: "transfer", category: "Savings" };
    const rrsp = accountIdSchema.parse("DEMO-RRSP-0003CAD");
    const out1 = tx({ id: "o1", amount: -25000, time: "17:04:22", classification: savings });
    const out2 = tx({ id: "o2", amount: -25000, time: "17:04:22", classification: savings });
    const in1 = tx({ id: "i1", accountId: fhsa, amount: 25000, time: "17:04:22", classification: savings });
    const in2 = tx({ id: "i2", accountId: rrsp, amount: 25000, time: "17:04:23", classification: savings });
    const links = linkTransfers([out1, out2, in1, in2]);
    expect(new Set([links.get(out1.id), links.get(out2.id)])).toEqual(new Set<AccountId>([fhsa, rrsp]));
    expect(links.get(in1.id)).toBe(chequing);
  });
});

describe("detectRecurring", () => {
  test("finds a biweekly paycheque and ignores irregular convenience purchases", () => {
    const pay = ["2026-09-03", "2026-09-17", "2026-10-01", "2026-10-15", "2026-10-29"].map((date) =>
      tx({ date, amount: 200000, merchant: "Example Employer", classification: salary }),
    );
    const snacks = ["2026-10-02", "2026-10-03", "2026-10-09", "2026-10-21"].map((date) =>
      tx({
        date,
        amount: -710,
        merchant: "Couche-Tard",
        classification: { kind: "expense", category: "Convenience" },
      }),
    );
    const result = detectRecurring([...pay, ...snacks]);
    expect(result.map((r) => [r.merchant, r.cadence, r.amount, r.nextDate])).toEqual([
      ["Example Employer", "biweekly", 200000, "2026-11-12"],
    ]);
  });
  test("keeps a monthly e-transfer despite one small one-off to the same person", () => {
    const people: Classification = { kind: "expense", category: "People" };
    const rows = [
      ["2026-07-31", -24500],
      ["2026-08-04", -3000],
      ["2026-08-31", -27500],
      ["2026-10-01", -27500],
      ["2026-10-31", -27500],
    ].map(([date, amount]) =>
      tx({ date: String(date), amount: Number(amount), merchant: "Example Person", classification: people }),
    );
    const [series] = detectRecurring(rows);
    expect([series?.cadence, series?.amount, series?.transactionIds.length]).toEqual(["monthly", -27500, 4]);
  });
});

describe("holdings and net worth", () => {
  test("nets buys and sells and values the position at the latest traded price", () => {
    const trade = (date: string, side: Trade["side"], quantity: number, unitPrice: number): Trade => ({
      id: date + side,
      accountId: fhsa,
      date,
      side,
      symbol: "VFV",
      securityName: "Vanguard S&P 500",
      quantity,
      unitPrice,
      netCash: 0,
    });
    const [position] = holdings([trade("2026-09-01", "buy", 2, 190), trade("2026-10-01", "sell", 0.5, 200)]);
    expect([position?.quantity, position?.value]).toEqual([1.5, 30000]);
  });
  test("derives month-end net worth backwards from the current total", () => {
    const history = netWorthHistory(100000, [
      tx({ date: "2026-09-14", amount: 50000, classification: salary }),
      tx({ date: "2026-10-03", amount: -20000 }),
      tx({ date: "2026-10-15", amount: -30000, classification: { kind: "transfer", category: "Savings" } }),
    ]);
    expect(history).toEqual([
      { month: "2026-09", value: 120000 },
      { month: "2026-10", value: 100000 },
    ]);
  });
});
