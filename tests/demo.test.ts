import { describe, expect, test } from "bun:test";
import { createDemo } from "../src/demo";
import type { Snapshot } from "../src/domain/types";

const now = new Date("2026-06-18T12:00:00Z");
const read = async (request: ReturnType<typeof createDemo>): Promise<Snapshot> =>
  request("/api/snapshot").json();

describe("static demo", () => {
  test("starts populated with fictional data across every finance surface", async () => {
    const state = await read(createDemo(now));
    expect(state.accounts).toHaveLength(4);
    expect(state.transactions.length).toBeGreaterThan(300);
    expect(new Set(state.transactions.map((t) => t.date.slice(0, 7))).size).toBe(12);
    expect(state.transactions.every((t) => t.id.startsWith("demo-") && t.accountId.startsWith("DEMO-"))).toBe(
      true,
    );
    expect(state.transactions.every((t) => t.date <= "2026-06-18")).toBe(true);
    expect(state.accounts.every((a) => a.balance > 0 && !a.partialHistory)).toBe(true);
    expect(state.holdings).toHaveLength(3);
    expect(state.recurring.length).toBeGreaterThan(4);
    expect(state.transactions.some((t) => !t.reviewed)).toBe(true);
    expect(state.transactions.some((t) => t.counterpartyAccountId)).toBe(true);
    expect(state.imports).toEqual([]);
  });
  test("category changes, allocations and plans affect only one visitor and reset on reload", async () => {
    const first = createDemo(now);
    const second = createDemo(now);
    const before = await read(first);
    const target = before.transactions.find((t) => !t.reviewed);
    const account = before.accounts.find((a) => a.type === "TFSA");
    if (!target || !account) throw new Error("Demo rows missing");
    expect(
      first(`/api/transactions/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ classification: { kind: "expense", category: "Dining" } }),
      }).status,
    ).toBe(204);
    expect(
      first(`/api/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify({ homeShare: 0.8 }) })
        .status,
    ).toBe(204);
    expect(
      first("/api/plan", { method: "PUT", body: JSON.stringify({ ...before.plan, monthly: 2500 }) }).status,
    ).toBe(204);
    const changed = await read(first);
    expect(changed.transactions.find((t) => t.id === target.id)?.classification.category).toBe("Dining");
    expect(changed.transactions.find((t) => t.id === target.id)?.reviewed).toBe(true);
    expect(changed.accounts.find((a) => a.id === account.id)?.homeShare).toBe(0.8);
    expect(changed.plan.monthly).toBe(2500);
    expect(await read(second)).toEqual(before);
    expect(await read(createDemo(now))).toEqual(before);
  });
  test("rejects uploads without accepting or storing their contents", async () => {
    const request = createDemo(now);
    const before = await read(request);
    expect(request("/api/import", { method: "POST", body: "not parsed" }).status).toBe(403);
    expect(await read(request)).toEqual(before);
    expect(
      request("/api/transactions/missing", {
        method: "PATCH",
        body: JSON.stringify({ classification: { kind: "expense", category: "Dining" } }),
      }).status,
    ).toBe(404);
  });
});
