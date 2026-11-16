import { describe, expect, test } from "bun:test";
import { ImportError, parseWealthsimple } from "../src/import/wealthsimple";

const chequing = `transaction_date,transaction_time,account_number,account_type,transaction_type,transaction_sub_type,status,payee,payee_email,amount,currency,notes
2026-10-29,17:09:37,DEMO-CHEQUING-0001,Chequing,Deposit,Aft,Completed,EXAMPLE EMPLOYER,,2000.00,CAD,
2026-10-29,17:09:54,DEMO-CHEQUING-0001,Chequing,Internal Transfer,Source,Completed,,,-250.00,CAD,
2026-10-29,17:09:54,DEMO-CHEQUING-0001,Chequing,Internal Transfer,Source,Completed,,,-250.00,CAD,
2026-10-21,00:49:12,DEMO-CHEQUING-0001,Chequing,Prepaid Card,Purchase,Completed,,,-10.00,CAD,
2026-10-22,10:00:00,DEMO-CHEQUING-0001,Chequing,Prepaid Card,Purchase,Completed,PROVIGO DEMO,,-20.00,CAD,
2026-10-23,11:00:00,DEMO-CHEQUING-0001,Chequing,Prepaid Card,Purchase,Completed,STEAMGAMES.COM,,-15.00,CAD,
2026-10-05,13:44:35,DEMO-CHEQUING-0001,Chequing,Spend,Prepaid,Completed,Popeyes Demo,,-30.00,CAD,
2026-10-06,13:44:35,DEMO-CHEQUING-0001,Chequing,Spend,Prepaid,Pending,Iga Extra,,-5.00,CAD,`;

const activities = `effective_date,effective_time,settlement_date,account_id,account_type,activity_type,activity_sub_type,description,direction,symbol,name,currency,quantity,unit_price,commission,net_cash_amount
2026-10-29,17:09:56,,DEMO-FHSA-0002CAD,FHSA,MoneyMovement,EFT,Deposit (executed at 2026-10-29),,,,CAD,250,,,250
2026-11-06,09:31:23,2026-11-09,DEMO-FHSA-0002CAD,FHSA,Trade,BUY,VFV: Bought 2 shares,LONG,VFV,Vanguard S&P 500 Index ETF,CAD,2,125,0,-250
2026-10-06,00:00:00,,DEMO-FHSA-0002CAD,FHSA,Dividend,-,"VFV: Cash dividend distribution, received",,VFV,Vanguard S&P 500 Index ETF,CAD,5.00,,,5.00`;

describe("parseWealthsimple", () => {
  test("classifies chequing rows and skips pending ones", () => {
    const result = parseWealthsimple(chequing);
    expect(result.format).toBe("chequing");
    expect(
      result.transactions.map((t) => [
        t.merchant,
        t.amount,
        t.classification.kind,
        t.classification.category,
        t.reviewed,
      ]),
    ).toEqual([
      ["Example Employer", 200000, "transfer", "From other bank", true],
      ["Transfer out", -25000, "transfer", "Savings", true],
      ["Transfer out", -25000, "transfer", "Savings", true],
      ["Card purchase", -1000, "expense", "Uncategorized", false],
      ["Provigo", -2000, "expense", "Groceries", true],
      ["Steam", -1500, "expense", "Entertainment", true],
      ["Popeyes", -3000, "expense", "Dining", true],
    ]);
    expect(result.skipped).toEqual(["Row 9: status Pending"]);
  });
  test("gives identical rows distinct ids that stay the same on re-import", () => {
    const [a, b] = [parseWealthsimple(chequing), parseWealthsimple(chequing)];
    expect(new Set(a.transactions.map((t) => t.id)).size).toBe(7);
    expect(a.transactions.map((t) => t.id)).toEqual(b.transactions.map((t) => t.id));
  });
  test("splits activities into a contribution, a dividend and a trade", () => {
    const result = parseWealthsimple(activities);
    expect(result.accounts.map((a) => [a.name, a.homeShare])).toEqual([["FHSA ··0002", 1]]);
    expect(result.transactions.map((t) => [t.classification.category, t.amount])).toEqual([
      ["Savings", 25000],
      ["Dividends", 500],
    ]);
    expect(result.trades.map((t) => [t.side, t.symbol, t.quantity, t.netCash])).toEqual([
      ["buy", "VFV", 2, -25000],
    ]);
  });
  test("rejects a CSV that is not a Wealthsimple export", () => {
    expect(() => parseWealthsimple("Date,Description,Amount\n2026-01-01,x,1")).toThrow(ImportError);
  });
});
