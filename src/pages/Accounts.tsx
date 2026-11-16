import type { Mutate } from "../App";
import { api } from "../api";
import { accountTone } from "../components/Sidebar";
import { AccountAvatar, Amount, Card, Detail, Screen } from "../components/ui";
import { investmentPerformance } from "../domain/insights";
import type { AccountId, AccountSummary, Holding, Snapshot, Trade } from "../domain/types";

export function Accounts({
  snapshot,
  mutate,
  selected,
  select,
}: {
  readonly snapshot: Snapshot;
  readonly mutate: Mutate;
  readonly selected: AccountId | null;
  readonly select: (id: AccountId | null) => void;
}) {
  const { accounts } = snapshot;
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const account = accounts.find((a) => a.id === selected);
  return (
    <Screen
      title="Accounts"
      detail={
        account && (
          <Detail title={account.name} onClose={() => select(null)}>
            <AccountDetail
              account={account}
              holdings={snapshot.holdings.filter((h) => h.accountId === account.id)}
              trades={snapshot.trades.filter((t) => t.accountId === account.id)}
              setHomeShare={(share) => mutate(() => api.setHomeShare(account.id, share))}
            />
          </Detail>
        )
      }
    >
      <Card className="hero">
        <div className="hero-head">
          <p className="label">Net worth</p>
          <p className="hero-value">
            <Amount cents={total} whole />
          </p>
        </div>
        <div className="stack-bar" aria-hidden="true">
          {accounts.map((a) => (
            <div key={a.id} style={{ flexGrow: a.balance, background: accountTone[a.type] }} />
          ))}
        </div>
        <div className="legend">
          {accounts.map((a) => (
            <span key={a.id}>
              <span className="dot" style={{ background: accountTone[a.type] }} />
              {a.name} {total > 0 ? `${((a.balance / total) * 100).toFixed(0)}%` : ""}
            </span>
          ))}
        </div>
      </Card>
      <Card>
        <div className="card-head">
          <h2>Wealthsimple</h2>
          <span className="muted">{accounts.length} accounts</span>
        </div>
        <div className="list">
          {accounts.map((a) => (
            <button
              type="button"
              className="row"
              key={a.id}
              aria-pressed={a.id === selected}
              onClick={() => select(a.id === selected ? null : a.id)}
            >
              <AccountAvatar type={a.type} />
              <span className="row-title">
                <span className="truncate">{a.name}</span>
                {a.partialHistory && <span className="badge">Partial</span>}
                <span className="row-sub">
                  {a.invested > 0 ? (
                    <>
                      <Amount cents={a.invested} whole /> invested · <Amount cents={a.cash} whole /> cash
                    </>
                  ) : (
                    "Cash"
                  )}
                </span>
              </span>
              {a.homeShare > 0 && (
                <span className="pill" data-tone="savings">
                  Home {Math.round(a.homeShare * 100)}%
                </span>
              )}
              <Amount cents={a.balance} />
            </button>
          ))}
        </div>
      </Card>
      <p className="footnote">
        Balances are the sum of every imported row; investments are valued at their last traded price in the
        export.
      </p>
    </Screen>
  );
}

function AccountDetail({
  account,
  holdings,
  trades,
  setHomeShare,
}: {
  readonly account: AccountSummary;
  readonly holdings: readonly Holding[];
  readonly trades: readonly Trade[];
  readonly setHomeShare: (share: number) => Promise<void>;
}) {
  const positions = investmentPerformance(holdings, trades);
  const bySymbol = new Map(positions.map((p) => [p.symbol, p]));
  const unrealized = positions.reduce((s, p) => s + p.unrealized, 0);
  return (
    <>
      <div className="detail-hero">
        <AccountAvatar type={account.type} size={40} />
        <div>
          <p className="muted">
            {account.institution} {account.type} · {account.number}
          </p>
          <h3>
            <Amount cents={account.balance} />
          </h3>
        </div>
      </div>
      {account.partialHistory && (
        <p className="callout">
          The export starts after this account opened, so earlier holdings and cash aren't counted.
        </p>
      )}
      <dl className="facts compact">
        <div>
          <dt>Cash</dt>
          <dd>
            <Amount cents={account.cash} />
          </dd>
        </div>
        <div>
          <dt>Invested</dt>
          <dd>
            <Amount cents={account.invested} />
          </dd>
        </div>
        <div>
          <dt>Unrealized gain</dt>
          <dd>
            <Amount cents={unrealized} signed />
          </dd>
        </div>
        <div>
          <dt>For home</dt>
          <dd>
            <Amount cents={account.balance * account.homeShare} whole />
          </dd>
        </div>
      </dl>
      {holdings.length > 0 && (
        <div className="detail-section">
          <div className="card-head">
            <h4>Holdings</h4>
            <span className="muted">Last price</span>
          </div>
          {holdings.map((h) => (
            <div className="holding" key={h.symbol}>
              <strong>{h.symbol}</strong>
              <span className="truncate muted">{h.securityName}</span>
              <span className="muted">{h.quantity.toFixed(4)} sh</span>
              <span>${h.lastPrice.toFixed(2)}</span>
              <Amount cents={bySymbol.get(h.symbol)?.unrealized ?? 0} signed />
              <Amount cents={h.value} />
            </div>
          ))}
        </div>
      )}
      <div className="detail-section">
        <h4>Set aside for your home</h4>
        <input
          type="range"
          name="homeShare"
          aria-label="Share of balance for the home goal"
          min={0}
          max={100}
          step={5}
          defaultValue={Math.round(account.homeShare * 100)}
          onPointerUp={(e) => void setHomeShare(Number(e.currentTarget.value) / 100)}
          onKeyUp={(e) => void setHomeShare(Number(e.currentTarget.value) / 100)}
        />
        <p className="muted">
          {Math.round(account.homeShare * 100)}% of this balance counts toward the home goal.
        </p>
      </div>
    </>
  );
}
