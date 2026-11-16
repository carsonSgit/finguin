import type { Transaction } from "../domain/types";
import { shortDate } from "../model";
import { useAccountName } from "./accounts-context";
import { Amount, CategoryPill, MerchantAvatar } from "./ui";

export function useTransactionTitle() {
  const accountName = useAccountName();
  return (t: Transaction) =>
    t.counterpartyAccountId
      ? `${t.amount < 0 ? "To" : "From"} ${accountName(t.counterpartyAccountId)}`
      : t.merchant;
}

export function TransactionRow({
  transaction: t,
  compact = false,
  selected = false,
  onSelect,
}: {
  readonly transaction: Transaction;
  readonly compact?: boolean;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
}) {
  const accountName = useAccountName();
  const title = useTransactionTitle();
  const body = (
    <>
      <MerchantAvatar transaction={t} />
      <span className="row-title">
        <span className="truncate">{title(t)}</span>
        {!t.reviewed && <span className="badge">Review</span>}
        <span className="row-sub">{compact ? shortDate(t.date) : accountName(t.accountId)}</span>
      </span>
      {!compact && <CategoryPill classification={t.classification} />}
      <Amount cents={t.amount} signed />
    </>
  );
  return onSelect ? (
    <button type="button" className="row" aria-pressed={selected} onClick={onSelect}>
      {body}
    </button>
  ) : (
    <div className="row">{body}</div>
  );
}
