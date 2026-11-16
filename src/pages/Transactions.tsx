import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { useState } from "react";
import type { Mutate } from "../App";
import { api } from "../api";
import { useAccountName } from "../components/accounts-context";
import { TransactionRow, useTransactionTitle } from "../components/TransactionRow";
import { Amount, categoryAsset, Detail, Emoji, Empty, MerchantAvatar, Screen, Tabs } from "../components/ui";
import { cashflow } from "../domain/analytics";
import {
  type Classification,
  classificationSchema,
  expenseCategories,
  incomeCategories,
  type Snapshot,
  type Transaction,
  transferCategories,
} from "../domain/types";
import { dayLabel, monthLabel } from "../model";

const filters = [
  ["all", "All"],
  ["expense", "Spending"],
  ["income", "Income"],
  ["transfer", "Transfers"],
  ["review", "Needs review"],
] as const;
type Filter = (typeof filters)[number][0];
const groupings = ["Day", "Merchant", "Category"] as const;
type Grouping = (typeof groupings)[number];

const groupKey: Record<Grouping, (t: Transaction) => string> = {
  Day: (t) => t.date,
  Merchant: (t) => t.merchant,
  Category: (t) => t.classification.category,
};

export function Transactions({ snapshot, mutate }: { readonly snapshot: Snapshot; readonly mutate: Mutate }) {
  const months = [...new Set(snapshot.transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const [month, setMonth] = useState(months[0] ?? "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [grouping, setGrouping] = useState<Grouping>("Day");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const monthRows = snapshot.transactions.filter((t) => month === "all" || t.date.startsWith(month));
  const flow = cashflow(monthRows);
  const rows = monthRows.filter(
    (t) =>
      `${t.merchant} ${t.payee}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || (filter === "review" ? !t.reviewed : t.classification.kind === filter)),
  );
  const groups = [...Map.groupBy(rows, groupKey[grouping])].map(([key, entries]) => ({
    key,
    entries,
    total: entries.reduce((s, t) => s + t.amount, 0),
  }));
  if (grouping !== "Day") groups.sort((a, b) => a.total - b.total);
  const selected = snapshot.transactions.find((t) => t.id === selectedId);
  return (
    <Screen
      title="Transactions"
      actions={
        <>
          <label className="search">
            <MagnifyingGlassIcon />
            <input
              name="search"
              aria-label="Search transactions"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select name="month" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </>
      }
      detail={
        selected && (
          <Detail title="Transaction" onClose={() => setSelectedId(null)}>
            <TransactionDetail
              transaction={selected}
              history={snapshot.transactions.filter(
                (t) => t.merchant === selected.merchant && t.id !== selected.id,
              )}
              reclassify={(classification) => mutate(() => api.reclassify(selected.id, classification))}
            />
          </Detail>
        )
      }
    >
      <div className="toolbar">
        <Tabs label="Filter" value={filter} options={filters} onChange={setFilter} />
        <Tabs label="Group by" variant="quiet" value={grouping} options={groupings} onChange={setGrouping} />
      </div>
      <p className="muted summary-line">
        {rows.length} transactions · in <Amount cents={flow.income} whole /> · spent{" "}
        <Amount cents={flow.spending} whole />
      </p>
      {groups.map(({ key, entries, total }) => (
        <section key={key} className="day">
          <h3 className="day-label">
            {grouping === "Day" ? (
              dayLabel(key)
            ) : (
              <>
                {grouping === "Category" && entries[0] && (
                  <Emoji name={categoryAsset[entries[0].classification.category]} size={16} />
                )}
                <span>{key}</span>
                <span className="muted">
                  {entries.length} · <Amount cents={total} signed />
                </span>
              </>
            )}
          </h3>
          <div className="list">
            {entries.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                selected={t.id === selectedId}
                onSelect={() => setSelectedId(t.id === selectedId ? null : t.id)}
              />
            ))}
          </div>
        </section>
      ))}
      {!rows.length && <Empty>No transactions match this view.</Empty>}
    </Screen>
  );
}

const encode = (c: Classification) => `${c.kind}:${c.category}`;
const decode = (value: string) => {
  const [kind, category] = value.split(":");
  return classificationSchema.parse({ kind, category });
};

function TransactionDetail({
  transaction: t,
  history,
  reclassify,
}: {
  readonly transaction: Transaction;
  readonly history: readonly Transaction[];
  readonly reclassify: (classification: Classification) => Promise<void>;
}) {
  const accountName = useAccountName();
  const title = useTransactionTitle();
  return (
    <>
      <div className="detail-hero">
        <MerchantAvatar transaction={t} />
        <div>
          <p className="muted">
            {dayLabel(t.date)} · {t.time.slice(0, 5)}
          </p>
          <h3>{title(t)}</h3>
          <p className="muted">{accountName(t.accountId)}</p>
        </div>
        <span className="detail-amount">
          <Amount cents={t.amount} signed />
        </span>
      </div>
      <dl className="props">
        <div>
          <dt>Category</dt>
          <dd>
            <select
              name="classification"
              aria-label="Category"
              value={encode(t.classification)}
              onChange={(e) => void reclassify(decode(e.target.value))}
            >
              <optgroup label="Spending">
                {expenseCategories.map((category) => (
                  <option key={category} value={`expense:${category}`}>
                    {category}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Income">
                {incomeCategories.map((category) => (
                  <option key={category} value={`income:${category}`}>
                    {category}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Transfer">
                {transferCategories.map((category) => (
                  <option key={category} value={`transfer:${category}`}>
                    {category}
                  </option>
                ))}
              </optgroup>
            </select>
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            {t.reviewed ? (
              <span className="muted">Reviewed</span>
            ) : (
              <button type="button" className="primary" onClick={() => void reclassify(t.classification)}>
                Confirm
              </button>
            )}
          </dd>
        </div>
        {t.payee && t.payee !== t.merchant && (
          <div>
            <dt>Statement</dt>
            <dd className="muted">{t.payee}</dd>
          </div>
        )}
      </dl>
      {history.length > 0 && (
        <div className="detail-section">
          <h4>Same merchant · {history.length}</h4>
          <div className="list">
            {history.slice(0, 10).map((h) => (
              <div className="mini-row" key={h.id}>
                <span className="muted">{dayLabel(h.date)}</span>
                <Amount cents={h.amount} signed />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
