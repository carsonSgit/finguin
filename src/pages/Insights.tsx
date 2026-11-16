import { useState } from "react";
import { TrendChart } from "../components/Chart";
import {
  Amount,
  Card,
  CategoryPill,
  categoryAsset,
  Emoji,
  Empty,
  MerchantAvatar,
  Screen,
  Tabs,
} from "../components/ui";
import {
  addDays,
  categoryTrends,
  forecast,
  monthlyFlows,
  topMerchants,
  yearSummary,
} from "../domain/insights";
import type { ExpenseCategory, Snapshot } from "../domain/types";
import { dollars, shortMonth } from "../model";

const merchantRanges = [
  ["3M", "3M"],
  ["6M", "6M"],
  ["12M", "12M"],
] as const;
type Range = (typeof merchantRanges)[number][0];
const rangeMonths: Record<Range, number> = { "3M": 3, "6M": 6, "12M": 12 };

export function Insights({ snapshot }: { readonly snapshot: Snapshot }) {
  const [range, setRange] = useState<Range>("6M");
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const cash = snapshot.accounts.reduce((s, a) => s + a.cash, 0);
  const projected = forecast(snapshot.recurring, cash, today, 6);
  const flows = monthlyFlows(snapshot.transactions, 6);
  const trends = categoryTrends(snapshot.transactions, 6, 6);
  const merchants = topMerchants(snapshot.transactions, addDays(today, -rangeMonths[range] * 31), 8);
  const ytd = yearSummary(snapshot.transactions, year);
  if (!snapshot.transactions.length)
    return (
      <Screen title="Insights">
        <Empty>No transactions yet.</Empty>
      </Screen>
    );
  return (
    <Screen title="Insights">
      <Card className="hero">
        <div className="hero-head">
          <p className="label">Safe to spend</p>
          <p className="hero-value">
            <Amount cents={projected.safeToSpend} whole />
          </p>
          <span className="delta">cash minus recurring bills due in the next 30 days</span>
        </div>
        <TrendChart
          valueLabel="Projected cash"
          points={projected.points.map((p) => ({ label: shortMonth(p.month), value: p.cents / 100 }))}
          summary={`Projected cash ${dollars(projected.points.at(-1)?.cents ?? 0)} in 6 months`}
        />
      </Card>
      <div className="grid-2">
        <Card>
          <div className="card-head">
            <h2>Savings rate</h2>
            <span className="muted">last {flows.length} months</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="align-right">Saved</th>
                  <th className="align-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.month}>
                    <td>{shortMonth(f.month)}</td>
                    <td className="align-right">
                      <Amount cents={f.saved} signed />
                    </td>
                    <td className="align-right">{f.rate === null ? "—" : `${f.rate.toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <h2>Spending movers</h2>
            <span className="muted">this month vs last</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="align-right">Now</th>
                  <th className="align-right">Was</th>
                  <th className="align-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t) => (
                  <tr key={t.category}>
                    <td>
                      <Emoji
                        name={categoryAsset[t.category as ExpenseCategory] ?? "uncategorized"}
                        size={14}
                      />{" "}
                      {t.category}
                    </td>
                    <td className="align-right">
                      <Amount cents={t.current} whole />
                    </td>
                    <td className="align-right">
                      <Amount cents={t.previous} whole />
                    </td>
                    <td className="align-right">
                      <Amount cents={t.delta} signed whole />{" "}
                      <span className="muted">
                        {t.pct === null ? "" : `${t.pct >= 0 ? "+" : ""}${t.pct.toFixed(0)}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!trends.length && <Empty>No spending yet.</Empty>}
        </Card>
        <Card>
          <div className="card-head">
            <h2>Top merchants</h2>
            <Tabs label="Range" variant="quiet" value={range} options={merchantRanges} onChange={setRange} />
          </div>
          <div className="list">
            {merchants.map((m) => (
              <div className="row" key={m.merchant}>
                <MerchantAvatar
                  transaction={{
                    merchant: m.merchant,
                    classification: { kind: "expense", category: m.category as ExpenseCategory },
                  }}
                />
                <span className="row-title">
                  <span className="truncate">{m.merchant}</span>
                  <span className="row-sub">{m.count} payments</span>
                </span>
                <CategoryPill classification={{ kind: "expense", category: m.category as ExpenseCategory }} />
                <Amount cents={m.value} whole />
              </div>
            ))}
          </div>
          {!merchants.length && <Empty>No spending in this range.</Empty>}
        </Card>
        <Card>
          <div className="card-head">
            <h2>{year} so far</h2>
            <span className="muted">year to date</span>
          </div>
          <dl className="facts compact">
            <div>
              <dt>Money in</dt>
              <dd>
                <Amount cents={ytd.income} whole />
              </dd>
            </div>
            <div>
              <dt>Spending</dt>
              <dd>
                <Amount cents={-ytd.spending} whole />
              </dd>
            </div>
            <div>
              <dt>Savings rate</dt>
              <dd>{ytd.rate === null ? "—" : `${ytd.rate.toFixed(0)}%`}</dd>
            </div>
            <div>
              <dt>Dividends</dt>
              <dd>
                <Amount cents={ytd.dividends} whole />
              </dd>
            </div>
            <div>
              <dt>Left over</dt>
              <dd>
                <Amount cents={ytd.saved} whole />
              </dd>
            </div>
          </dl>
          <div className="list">
            {ytd.byCategory.slice(0, 5).map((c) => (
              <div className="mini-row" key={c.name}>
                <span>
                  <Emoji name={categoryAsset[c.name as ExpenseCategory] ?? "uncategorized"} size={14} />{" "}
                  {c.name}
                </span>
                <Amount cents={c.value} whole />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-head">
          <h2>Category trends</h2>
          <span className="muted">last {trends[0]?.months.length ?? 0} months</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                {(trends[0]?.months ?? []).map((m) => (
                  <th key={m} className="align-right">
                    {shortMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => (
                <tr key={t.category}>
                  <td>{t.category}</td>
                  {t.values.map((v, i) => (
                    <td key={t.months[i]} className="align-right">
                      {v > 0 ? <Amount cents={v} whole /> : <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Screen>
  );
}
