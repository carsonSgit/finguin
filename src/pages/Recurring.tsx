import { CheckIcon } from "@heroicons/react/16/solid";
import { useState } from "react";
import { useAccountName } from "../components/accounts-context";
import { TrendChart } from "../components/Chart";
import { useTransactionTitle } from "../components/TransactionRow";
import { Amount, Card, CategoryPill, Detail, Empty, MerchantAvatar, Screen } from "../components/ui";
import type { Kind, RecurringSeries, Snapshot, Transaction } from "../domain/types";
import { shortDate, shortMonth } from "../model";

const sections: readonly (readonly [Kind, string])[] = [
  ["expense", "Bills & subscriptions"],
  ["income", "Income"],
  ["transfer", "Savings"],
];

export function Recurring({ snapshot }: { readonly snapshot: Snapshot }) {
  const [selected, setSelected] = useState<string | null>(null);
  const title = useTransactionTitle();
  const accountName = useAccountName();
  const byId = new Map(snapshot.transactions.map((t) => [t.id, t]));
  const month = snapshot.transactions[0]?.date.slice(0, 7) ?? "";
  const bills = snapshot.recurring.filter((r) => r.classification.kind === "expense");
  const paid = bills.filter((r) => r.lastDate.startsWith(month)).reduce((s, r) => s - r.amount, 0);
  const left = bills.filter((r) => r.nextDate.startsWith(month)).reduce((s, r) => s - r.amount, 0);
  const share = paid + left > 0 ? paid / (paid + left) : 0;
  const current = snapshot.recurring.find((r) => r.key === selected);
  const seriesTitle = (r: RecurringSeries) => {
    const lastId = r.transactionIds.at(-1);
    const last = lastId && byId.get(lastId);
    return last ? title(last) : r.merchant;
  };
  return (
    <Screen
      title="Recurring"
      detail={
        current && (
          <Detail
            title={`${current.cadence[0]?.toUpperCase()}${current.cadence.slice(1)} recurring`}
            onClose={() => setSelected(null)}
          >
            <RecurringDetail
              series={current}
              title={seriesTitle(current)}
              charges={current.transactionIds.flatMap((id) => byId.get(id) ?? [])}
            />
          </Detail>
        )
      }
    >
      <Card className="donut-card">
        <div className="donut-side">
          <Amount cents={left} whole />
          <span className="muted">left to pay</span>
        </div>
        <svg className="donut" viewBox="0 0 42 42" aria-hidden="true">
          <circle cx="21" cy="21" r="15.9" pathLength="100" />
          <circle cx="21" cy="21" r="15.9" pathLength="100" strokeDasharray={`${share * 100} 100`} />
        </svg>
        <div className="donut-side">
          <Amount cents={paid} whole />
          <span className="muted">paid this month</span>
        </div>
      </Card>
      <Card>
        <div className="card-head">
          <h2>Audit</h2>
          <span className="muted">{bills.length} active bills</span>
        </div>
        <dl className="facts compact">
          <div>
            <dt>Per month</dt>
            <dd>
              <Amount cents={bills.reduce((s, r) => s + monthlyEquivalent(r), 0)} whole />
            </dd>
          </div>
          <div>
            <dt>Per year</dt>
            <dd>
              <Amount cents={bills.reduce((s, r) => s + monthlyEquivalent(r) * 12, 0)} whole />
            </dd>
          </div>
          <div>
            <dt>Not seen lately</dt>
            <dd>
              {
                snapshot.recurring.filter(
                  (r) => !r.lastDate.startsWith(month) && r.nextDate < (snapshot.transactions[0]?.date ?? ""),
                ).length
              }
            </dd>
          </div>
        </dl>
      </Card>
      {sections.map(([kind, label]) => {
        const items = snapshot.recurring.filter((r) => r.classification.kind === kind);
        if (!items.length) return null;
        return (
          <Card key={kind}>
            <div className="card-head">
              <h2>{label}</h2>
              <span className="muted">
                <Amount cents={items.reduce((s, r) => s + monthlyEquivalent(r), 0)} whole /> / month
              </span>
            </div>
            <div className="list">
              {items.map((r) => {
                const done = r.lastDate.startsWith(month);
                const late = !done && r.nextDate < (snapshot.transactions[0]?.date ?? "");
                return (
                  <button
                    type="button"
                    className="row recurring-row"
                    key={r.key}
                    aria-pressed={r.key === selected}
                    onClick={() => setSelected(r.key === selected ? null : r.key)}
                  >
                    <span className="muted date-col">{shortDate(done ? r.lastDate : r.nextDate)}</span>
                    <MerchantAvatar transaction={r} />
                    <span className="row-title">
                      <span className="truncate">{seriesTitle(r)}</span>
                      {late && <span className="badge">Not seen</span>}
                      <span className="row-sub">
                        {r.cadence} · {accountName(r.accountId)}
                      </span>
                    </span>
                    <CategoryPill classification={r.classification} />
                    <Amount cents={r.amount} signed />
                    <span
                      className={`check ${done ? "is-done" : ""}`}
                      title={done ? "Done this month" : "Upcoming"}
                    >
                      {done && <CheckIcon />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
      {!snapshot.recurring.length && (
        <Empty>Import a few months of activity to detect recurring payments.</Empty>
      )}
    </Screen>
  );
}

const perMonth = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1 } as const;
const monthlyEquivalent = (r: RecurringSeries) => r.amount * perMonth[r.cadence];

function RecurringDetail({
  series,
  title,
  charges,
}: {
  readonly series: RecurringSeries;
  readonly title: string;
  readonly charges: readonly Transaction[];
}) {
  const accountName = useAccountName();
  const amounts = charges.map((c) => Math.abs(c.amount));
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const total = charges.reduce((s, c) => s + c.amount, 0);
  return (
    <>
      <div className="detail-hero">
        <MerchantAvatar transaction={series} />
        <div>
          <CategoryPill classification={series.classification} />
          <h3>{title}</h3>
          <p className="muted">{accountName(series.accountId)}</p>
        </div>
        <div className="detail-amount">
          <span className="muted">Next</span>
          <Amount cents={series.amount} signed />
          <span className="muted">around {shortDate(series.nextDate)}</span>
        </div>
      </div>
      <div className="detail-section">
        <h4>Rules</h4>
        <div className="chips">
          <span className="chip">
            named <b>{series.merchant}</b>
          </span>
          <span className="chip">
            {min === max ? (
              <>
                exactly <Amount cents={min} />
              </>
            ) : (
              <>
                from <Amount cents={min} /> to <Amount cents={max} />
              </>
            )}
          </span>
          <span className="chip">
            every {series.cadence === "biweekly" ? "2 weeks" : series.cadence.replace("ly", "")}
          </span>
        </div>
      </div>
      {min !== max && (
        <TrendChart
          valueLabel="Amount"
          points={charges.map((c) => ({
            label: shortMonth(c.date.slice(0, 7)),
            value: Math.abs(c.amount) / 100,
          }))}
          aspectRatio="2.4 / 1"
          summary={`${charges.length} occurrences`}
        />
      )}
      <dl className="facts compact detail-section">
        <div>
          <dt>Total</dt>
          <dd>
            <Amount cents={total} signed />
          </dd>
        </div>
        <div>
          <dt>Per month</dt>
          <dd>
            <Amount cents={monthlyEquivalent(series)} signed />
          </dd>
        </div>
        <div>
          <dt>Seen</dt>
          <dd>{charges.length}×</dd>
        </div>
      </dl>
      <div className="detail-section">
        <h4>History</h4>
        <div className="list">
          {charges.toReversed().map((c) => (
            <div className="mini-row" key={c.id}>
              <span className="muted">{shortDate(c.date)}</span>
              <Amount cents={c.amount} signed />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
