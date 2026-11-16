import { XMarkIcon } from "@heroicons/react/16/solid";
import { type ReactNode, useId } from "react";
import { brandFor } from "../brands";
import type { AccountType, Category, Classification, Transaction } from "../domain/types";

export const categoryAsset: Record<Category, string> = {
  Groceries: "groceries",
  Dining: "dining",
  Convenience: "convenience",
  Transport: "transport",
  Shopping: "shopping",
  Health: "health",
  "Personal care": "personal-care",
  Subscriptions: "subscriptions",
  Entertainment: "entertainment",
  Education: "education",
  "Cannabis & vape": "cannabis",
  People: "people",
  "Fees & tax": "fees",
  Uncategorized: "uncategorized",
  Salary: "salary",
  Interest: "interest",
  Dividends: "dividends",
  Rewards: "rewards",
  "E-transfers in": "etransfer-in",
  Savings: "savings",
  "Card payment": "card-payment",
  "Between accounts": "transfer",
  "From other bank": "chequing",
};
const accountAsset: Record<AccountType, string> = {
  Chequing: "chequing",
  TFSA: "tfsa",
  FHSA: "fhsa",
  RRSP: "rrsp",
};

export function Emoji({ name, size = 20 }: { readonly name: string; readonly size?: number }) {
  return <img className="emoji" src={`/emoji/${name}.png`} alt="" width={size} height={size} />;
}

export function Amount({
  cents,
  signed = false,
  whole = false,
}: {
  readonly cents: number;
  readonly signed?: boolean;
  readonly whole?: boolean;
}) {
  const abs = Math.abs(Math.round(cents));
  const dollars = new Intl.NumberFormat("en-CA").format(Math.floor(abs / 100));
  const sign = cents < 0 ? "−" : signed && cents > 0 ? "+" : "";
  return (
    <span className={`amount${signed && cents > 0 ? " is-positive" : ""}`}>
      {sign}${dollars}
      {!whole && <sup>.{String(abs % 100).padStart(2, "0")}</sup>}
    </span>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
  variant = "pills",
}: {
  readonly value: T;
  readonly options: readonly (T | readonly [T, string])[];
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly variant?: "pills" | "quiet";
}) {
  return (
    <div className={`tabs tabs-${variant}`} role="tablist" aria-label={label}>
      {options.map((option) => {
        const [key, text] = typeof option === "string" ? [option, option] : option;
        return (
          <button
            type="button"
            role="tab"
            key={key}
            aria-selected={value === key}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryPill({ classification }: { readonly classification: Classification }) {
  const asset = categoryAsset[classification.category];
  return (
    <span className="pill" data-tone={asset}>
      <Emoji name={asset} size={14} />
      {classification.category}
    </span>
  );
}

export function MerchantAvatar({
  transaction,
}: {
  readonly transaction: Pick<Transaction, "merchant" | "classification">;
}) {
  const brand = brandFor(transaction.merchant);
  if (brand)
    return (
      <span className="avatar brand" style={{ background: `#${brand.hex}` }} title={brand.title}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={brand.path} />
        </svg>
      </span>
    );
  return (
    <span className="avatar">
      <Emoji name={categoryAsset[transaction.classification.category]} size={20} />
    </span>
  );
}

export function AccountAvatar({ type, size = 32 }: { readonly type: AccountType; readonly size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      <Emoji name={accountAsset[type]} size={Math.round(size * 0.62)} />
    </span>
  );
}

export function Screen({
  title,
  actions,
  detail,
  children,
}: {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly detail?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={`screen${detail ? " has-detail" : ""}`}>
      <div className="screen-main">
        <header className="screen-header">
          <h1>{title}</h1>
          <div className="screen-actions">{actions}</div>
        </header>
        <div className="screen-body">{children}</div>
      </div>
      {detail}
    </div>
  );
}

export function Detail({
  title,
  onClose,
  children,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <aside className="detail" aria-labelledby={id}>
      <header className="screen-header">
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}>
          <XMarkIcon />
        </button>
      </header>
      <div className="detail-body">{children}</div>
    </aside>
  );
}

export function Card({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Empty({ children }: { readonly children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
