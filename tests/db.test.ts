import { expect, test } from "bun:test";
import { importParsed, openDb, reclassify, snapshot } from "../server/db";
import { parseWealthsimple } from "../src/import/wealthsimple";

const csv = `transaction_date,transaction_time,account_number,account_type,transaction_type,transaction_sub_type,status,payee,payee_email,amount,currency,notes
2026-10-21,00:49:12,DEMO-CHEQUING-0001,Chequing,Prepaid Card,Purchase,Completed,,,-10.00,CAD,
2026-10-29,17:09:54,DEMO-CHEQUING-0001,Chequing,Internal Transfer,Source,Completed,,,-250.00,CAD,`;
const fhsa = `effective_date,effective_time,settlement_date,account_id,account_type,activity_type,activity_sub_type,description,direction,symbol,name,currency,quantity,unit_price,commission,net_cash_amount
2026-10-29,17:09:56,,DEMO-FHSA-0002CAD,FHSA,MoneyMovement,EFT,Deposit,,,,CAD,250,,,250`;

const header =
  "transaction_date,transaction_time,account_number,account_type,transaction_type,transaction_sub_type,status,payee,payee_email,amount,currency,notes";
const blankCard = `${header}\n2026-10-21,00:49:12,DEMO-CHEQUING-0001,Chequing,Prepaid Card,Purchase,Completed,,,-10.00,CAD,`;
const filledCard = `${header}\n2026-10-21,00:49:12,DEMO-CHEQUING-0001,Chequing,Prepaid Card,Purchase,Completed,PROVIGO DEMO,,-10.00,CAD,`;

test("a re-export that backfills the payee updates the existing row instead of duplicating it", () => {
  const db = openDb(":memory:");
  expect(importParsed(db, parseWealthsimple(blankCard), "old.csv").added).toBe(1);
  expect(importParsed(db, parseWealthsimple(filledCard), "new.csv").added).toBe(0);
  let rows = snapshot(db).transactions;
  expect(rows).toHaveLength(1);
  expect(rows[0]?.payee).toBe("PROVIGO DEMO");
  expect(rows[0]?.classification).toEqual({ kind: "expense", category: "Groceries" });
  expect(rows[0]?.reviewed).toBe(true);
  importParsed(db, parseWealthsimple(blankCard), "old.csv");
  rows = snapshot(db).transactions;
  expect(rows).toHaveLength(1);
  expect(rows[0]?.payee).toBe("PROVIGO DEMO");
});

test("import removes blank-payee duplicates left behind by a payee backfill", () => {
  const db = openDb(":memory:");
  importParsed(db, parseWealthsimple(csv), "old.csv");
  db.query(
    `INSERT INTO transactions (id, account_id, date, time, amount, payee, merchant, kind, category, counterparty_account_id, reviewed, classified_by)
     VALUES ('dupe', 'DEMO-CHEQUING-0001', '2026-10-21', '00:49:12', -1000, 'PROVIGO DEMO', 'Provigo', 'expense', 'Groceries', NULL, 1, 'rules')`,
  ).run();
  expect(snapshot(db).transactions).toHaveLength(3);
  importParsed(db, parseWealthsimple(csv), "old.csv");
  const rows = snapshot(db).transactions;
  expect(rows).toHaveLength(2);
  expect(rows.find((t) => t.amount === -1000)?.payee).toBe("PROVIGO DEMO");
});

test("re-importing adds nothing, keeps a user's category and links the transfer legs", () => {
  const db = openDb(":memory:");
  expect(importParsed(db, parseWealthsimple(csv), "a.csv").added).toBe(2);
  importParsed(db, parseWealthsimple(fhsa), "b.csv");
  const card = snapshot(db).transactions.find((t) => t.merchant === "Card purchase");
  if (!card) throw new Error("card purchase missing");
  reclassify(db, card.id, { kind: "expense", category: "Groceries" });
  expect(importParsed(db, parseWealthsimple(csv), "a.csv").added).toBe(0);
  const after = snapshot(db);
  expect(after.transactions.find((t) => t.id === card.id)?.classification).toEqual({
    kind: "expense",
    category: "Groceries",
  });
  expect(
    after.transactions
      .filter((t) => t.counterpartyAccountId)
      .map((t) => `${t.amount} ${t.counterpartyAccountId}`),
  ).toEqual(["25000 DEMO-CHEQUING-0001", "-25000 DEMO-FHSA-0002CAD"]);
});

test("a fresh install creates the database directory and starts empty", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "finguin-db-"));
  try {
    const db = openDb(join(dir, "nested", "finguin.db"));
    expect(snapshot(db).transactions).toHaveLength(0);
    expect(snapshot(db).accounts).toHaveLength(0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
