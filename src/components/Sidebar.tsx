import {
  ArrowDownTrayIcon,
  ArrowPathRoundedSquareIcon,
  BanknotesIcon,
  ChartBarIcon,
  CircleStackIcon,
  HomeModernIcon,
  PaperAirplaneIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import type { ComponentType, SVGProps } from "react";
import type { AccountId, AccountSummary, AccountType } from "../domain/types";
import { money } from "../model";
import { Emoji } from "./ui";

export const pages = ["Dashboard", "Transactions", "Insights", "Accounts", "Recurring", "Home goal"] as const;
export type Page = (typeof pages)[number] | "Your data";

const icons: Record<Page, ComponentType<SVGProps<SVGSVGElement>>> = {
  Dashboard: PaperAirplaneIcon,
  Transactions: Squares2X2Icon,
  Insights: ChartBarIcon,
  Accounts: BanknotesIcon,
  Recurring: ArrowPathRoundedSquareIcon,
  "Home goal": HomeModernIcon,
  "Your data": CircleStackIcon,
};
const groups: readonly (readonly [string, readonly AccountType[]])[] = [
  ["Cash", ["Chequing"]],
  ["Registered", ["FHSA", "TFSA", "RRSP"]],
];
export const accountTone: Record<AccountType, string> = {
  Chequing: "var(--tone-orange)",
  TFSA: "var(--tone-blue)",
  FHSA: "var(--tone-green)",
  RRSP: "var(--tone-violet)",
};

export function Sidebar({
  page,
  accounts,
  open,
  navigate,
  openAccount,
  onImport,
  onClose,
}: {
  readonly page: Page;
  readonly accounts: readonly AccountSummary[];
  readonly open: boolean;
  readonly navigate: (page: Page) => void;
  readonly openAccount: (id: AccountId) => void;
  readonly onImport: () => void;
  readonly onClose: () => void;
}) {
  const item = (target: Page) => {
    const Icon = icons[target];
    return (
      <button
        type="button"
        key={target}
        className="nav-item"
        aria-current={page === target ? "page" : undefined}
        onClick={() => navigate(target)}
      >
        <Icon />
        {target}
      </button>
    );
  };
  return (
    <aside className={`sidebar${open ? " is-open" : ""}`}>
      <div className="sidebar-top">
        <div className="brand">
          <Emoji name="penguin" size={22} />
          Finguin
        </div>
        <button type="button" className="icon-button mobile-only" aria-label="Close menu" onClick={onClose}>
          <XMarkIcon />
        </button>
      </div>
      <nav aria-label="Main">{pages.map(item)}</nav>
      <div className="sidebar-accounts">
        {groups.map(([group, types]) => {
          const rows = accounts.filter((a) => types.includes(a.type));
          if (!rows.length) return null;
          return (
            <div key={group}>
              <p className="sidebar-label">{group}</p>
              {rows.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className="sidebar-account"
                  onClick={() => openAccount(a.id)}
                >
                  <span className="dot" style={{ background: accountTone[a.type] }} />
                  <span className="truncate">{a.name}</span>
                  <span className="muted">{money(a.balance)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="sidebar-bottom">
        <button type="button" className="nav-item" onClick={onImport}>
          <ArrowDownTrayIcon />
          Import CSV
        </button>
        {item("Your data")}
      </div>
    </aside>
  );
}
