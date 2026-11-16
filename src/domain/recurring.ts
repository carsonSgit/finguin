import type { Cadence, RecurringSeries, Transaction } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const period: Record<Cadence, number> = { weekly: 7, biweekly: 14, monthly: 30.4 };
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const median = (values: readonly number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

function addCadence(date: string, cadence: Cadence) {
  const d = new Date(`${date}T12:00:00`);
  if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + period[cadence]);
  return d.toLocaleDateString("en-CA");
}

function cadenceOf(gap: number): Cadence | null {
  if (gap >= 6 && gap <= 8) return "weekly";
  if (gap >= 12 && gap <= 16) return "biweekly";
  if (gap >= 26 && gap <= 35) return "monthly";
  return null;
}

/** Amounts in these categories legitimately vary between occurrences. */
const variableAmount = new Set(["Card payment", "Interest"]);

export function detectRecurring(transactions: readonly Transaction[]): RecurringSeries[] {
  const latest = transactions.reduce((max, t) => (t.date > max ? t.date : max), "");
  const groups = Map.groupBy(
    transactions.filter(
      (t) =>
        t.classification.category !== "Uncategorized" &&
        !(t.classification.kind === "transfer" && t.amount > 0),
    ),
    (t) => [t.classification.kind, t.merchant, t.accountId, t.counterpartyAccountId ?? ""].join("|"),
  );
  const series: RecurringSeries[] = [];
  for (const [key, rows] of groups) {
    const first = rows[0];
    if (!first) continue;
    const typical = median(rows.map((t) => Math.abs(t.amount)));
    const tolerance = variableAmount.has(first.classification.category) ? Number.POSITIVE_INFINITY : 0.25;
    const core = rows
      .filter((t) => Math.abs(Math.abs(t.amount) - typical) <= typical * tolerance)
      .toSorted((a, b) => a.date.localeCompare(b.date));
    const identical = new Set(core.map((t) => t.amount)).size === 1;
    const minimum = identical && first.classification.category === "Subscriptions" ? 2 : 3;
    if (core.length < minimum) continue;
    const gaps = core.slice(1).map((t, i) => days(core[i]?.date ?? t.date, t.date));
    const cadence = cadenceOf(median(gaps));
    if (!cadence) continue;
    const regular = gaps.filter((g) => Math.abs(g - period[cadence]) <= period[cadence] * 0.4).length;
    if (regular < gaps.length * 0.6) continue;
    const last = core.at(-1);
    if (!last || days(last.date, latest) > period[cadence] * 2) continue;
    series.push({
      key,
      accountId: first.accountId,
      merchant: first.merchant,
      classification: first.classification,
      cadence,
      amount: Math.round(median(core.map((t) => t.amount))),
      transactionIds: core.map((t) => t.id),
      lastDate: last.date,
      nextDate: addCadence(last.date, cadence),
    });
  }
  return series.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}
