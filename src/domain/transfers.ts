import type { AccountId, Transaction, TransactionId } from "./types";

const at = (t: Transaction) => new Date(`${t.date}T${t.time || "00:00:00"}`).getTime();
const windows = [2 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];

/** Pairs each outgoing transfer with the incoming leg in another account: same amount, nearest in time. */
export function linkTransfers(transactions: readonly Transaction[]): Map<TransactionId, AccountId> {
  const links = new Map<TransactionId, AccountId>();
  const transfers = transactions.filter((t) => t.classification.kind === "transfer");
  const incoming = transfers.filter((t) => t.amount > 0);
  const outgoing = transfers.filter((t) => t.amount < 0).toSorted((a, b) => at(a) - at(b));
  for (const window of windows) {
    for (const out of outgoing) {
      if (links.has(out.id)) continue;
      const match = incoming
        .filter(
          (inc) =>
            !links.has(inc.id) &&
            inc.accountId !== out.accountId &&
            inc.amount === -out.amount &&
            Math.abs(at(inc) - at(out)) <= window,
        )
        .toSorted((a, b) => Math.abs(at(a) - at(out)) - Math.abs(at(b) - at(out)))[0];
      if (!match) continue;
      links.set(out.id, match.accountId);
      links.set(match.id, out.accountId);
    }
  }
  return links;
}
