import { ArrowUpRightIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import { useState } from "react";
import { TrendChart } from "../components/Chart";
import type { Page } from "../components/Sidebar";
import { TransactionRow } from "../components/TransactionRow";
import { Amount, Card, categoryAsset, Emoji, Empty, Screen, Tabs } from "../components/ui";
import { cashflow, netWorthHistory, spendingByCategory } from "../domain/analytics";
import { duration, projection } from "../domain/plan";
import type { Snapshot } from "../domain/types";
import { dollars, monthLabel, shortMonth } from "../model";

const ranges = ["3M", "6M", "1Y"] as const;
type Range = (typeof ranges)[number];
const rangeMonths: Record<Range, number> = { "3M": 3, "6M": 6, "1Y": 12 };

export function Dashboard({
  snapshot,
  navigate,
}: {
  readonly snapshot: Snapshot;
  readonly navigate: (page: Page) => void;
}) {
  const [range, setRange] = useState<Range>("1Y");
  const total = snapshot.accounts.reduce((sum, a) => sum + a.balance, 0);
  const history = netWorthHistory(total, snapshot.transactions).slice(-rangeMonths[range]);
  const first = history[0]?.value ?? total;
  const change = first > 0 ? ((total - first) / first) * 100 : 0;
  const recentMonths = netWorthHistory(total, snapshot.transactions)
    .slice(-3)
    .map((p) => p.month);
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? recentMonths.at(-2) ?? recentMonths.at(-1) ?? "";
  const rows = snapshot.transactions.filter((t) => t.date.startsWith(month));
  const flow = cashflow(rows);
  const groups = spendingByCategory(rows);
  const largest = groups[0]?.value ?? 1;
  const saved = Math.round(snapshot.accounts.reduce((sum, a) => sum + a.balance * a.homeShare, 0) / 100);
  const goal = projection(saved, snapshot.plan);
  const progress = Math.min((saved / goal.target) * 100, 100);
  const recent = snapshot.transactions.slice(0, 6);
  return (
    <Screen title="Dashboard">
      <Card className="hero">
        <div className="hero-head">
          <p className="label">Net worth</p>
          <p className="hero-value">
            <Amount cents={total} whole />
          </p>
          <span className={`delta ${change < 0 ? "is-negative" : ""}`}>
            {change >= 0 ? "↗" : "↘"} {Math.abs(change).toFixed(1)}% over {range}
          </span>
        </div>
        <TrendChart
          valueLabel="Net worth"
          points={history.map((p) => ({ label: shortMonth(p.month), value: p.value / 100 }))}
          summary={`Net worth ${dollars(total / 100)}`}
        />
        <Tabs label="Range" variant="quiet" value={range} options={ranges} onChange={setRange} />
      </Card>
      <div className="grid-2">
        <Card>
          <div className="card-head">
            <h2>{month ? monthLabel(month) : "This month"}</h2>
            <Tabs
              label="Month"
              variant="quiet"
              value={month}
              options={recentMonths.map((m) => [m, shortMonth(m)] as const)}
              onChange={setPicked}
            />
          </div>
          <dl className="facts">
            <div>
              <dt>Money in</dt>
              <dd>
                <Amount cents={flow.income} signed />
              </dd>
            </div>
            <div>
              <dt>Spending</dt>
              <dd>
                <Amount cents={-flow.spending} />
              </dd>
            </div>
            <div>
              <dt>Left over</dt>
              <dd>
                <Amount cents={flow.saved} />
              </dd>
            </div>
            <div>
              <dt>Savings rate</dt>
              <dd>{flow.rate === null ? "—" : `${flow.rate.toFixed(0)}%`}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <div className="card-head">
            <h2>
              <Emoji name="fhsa" size={18} /> Home goal
            </h2>
            <button type="button" className="text-button" onClick={() => navigate("Home goal")}>
              Open plan <ArrowUpRightIcon />
            </button>
          </div>
          <p className="goal-figure">
            {dollars(saved)} <span className="muted">of {dollars(goal.target)}</span>
          </p>
          <div
            className="meter"
            role="progressbar"
            aria-label="Home goal funded"
            aria-valuenow={Math.round(progress)}
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          <dl className="facts compact">
            <div>
              <dt>Funded</dt>
              <dd>{progress.toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Monthly</dt>
              <dd>{dollars(snapshot.plan.monthly)}</dd>
            </div>
            <div>
              <dt>Ready in</dt>
              <dd>{duration(goal.months)}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <div className="grid-2">
        <Card>
          <div className="card-head">
            <h2>Spending by category</h2>
            <span className="muted">
              <Amount cents={flow.spending} whole />
            </span>
          </div>
          <ul className="bars">
            {groups.map((g) => (
              <li key={g.name}>
                <Emoji name={categoryAsset[g.name]} size={18} />
                <span>{g.name}</span>
                <div className="bar">
                  <div style={{ width: `${Math.max((g.value / largest) * 100, 2)}%` }} />
                </div>
                <Amount cents={g.value} whole />
              </li>
            ))}
          </ul>
          {!groups.length && <Empty>Import a statement to see where your money goes.</Empty>}
        </Card>
        <Card>
          <div className="card-head">
            <h2>Recent</h2>
            <button type="button" className="text-button" onClick={() => navigate("Transactions")}>
              View all <ChevronRightIcon />
            </button>
          </div>
          <div className="list">
            {recent.map((t) => (
              <TransactionRow key={t.id} transaction={t} compact />
            ))}
          </div>
          {!recent.length && <Empty>Your activity appears after your first import.</Empty>}
        </Card>
      </div>
    </Screen>
  );
}
