import { Bars3Icon } from "@heroicons/react/16/solid";
import { useState } from "react";
import { isDemo, useSnapshot } from "./api";
import { AccountsContext } from "./components/accounts-context";
import { ImportDialog } from "./components/ImportDialog";
import { type Page, Sidebar } from "./components/Sidebar";
import type { AccountId, Snapshot } from "./domain/types";
import { Accounts } from "./pages/Accounts";
import { Dashboard } from "./pages/Dashboard";
import { Data } from "./pages/Data";
import { HomeGoal } from "./pages/HomeGoal";
import { Insights } from "./pages/Insights";
import { Recurring } from "./pages/Recurring";
import { Transactions } from "./pages/Transactions";

export type Mutate = (action: () => Promise<unknown>) => Promise<void>;

export function App() {
  const { state, refresh } = useSnapshot();
  const [page, setPage] = useState<Page>("Dashboard");
  const [account, setAccount] = useState<AccountId | null>(null);
  const [importing, setImporting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const mutate: Mutate = async (action) => {
    try {
      await action();
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
    await refresh();
  };
  function navigate(next: Page) {
    setPage(next);
    setAccount(null);
    setMenu(false);
  }
  function openImport() {
    if (isDemo) setError("CSV import is available in the local app. This demo uses fictional data.");
    else setImporting(true);
  }
  function content(snapshot: Snapshot) {
    switch (page) {
      case "Dashboard":
        return <Dashboard snapshot={snapshot} navigate={navigate} />;
      case "Transactions":
        return <Transactions snapshot={snapshot} mutate={mutate} />;
      case "Insights":
        return <Insights snapshot={snapshot} />;
      case "Accounts":
        return <Accounts snapshot={snapshot} mutate={mutate} selected={account} select={setAccount} />;
      case "Recurring":
        return <Recurring snapshot={snapshot} />;
      case "Home goal":
        return <HomeGoal snapshot={snapshot} mutate={mutate} />;
      case "Your data":
        return <Data snapshot={snapshot} onImport={openImport} />;
      default: {
        const exhaustive: never = page;
        return exhaustive;
      }
    }
  }
  if (state.status === "loading") return <div className="splash">Loading…</div>;
  if (state.status === "error")
    return (
      <div className="splash">
        <p>The finguin API isn't reachable: {state.message}</p>
        <button type="button" onClick={() => void refresh()}>
          Retry
        </button>
      </div>
    );
  const { snapshot } = state;
  return (
    <AccountsContext value={new Map(snapshot.accounts.map((a) => [a.id, a]))}>
      <div className="app">
        <Sidebar
          page={page}
          accounts={snapshot.accounts}
          open={menu}
          navigate={navigate}
          openAccount={(id) => {
            navigate("Accounts");
            setAccount(id);
          }}
          onImport={openImport}
          onClose={() => setMenu(false)}
        />
        <main className="main">
          {isDemo && (
            <div className="banner" role="status">
              <span>Demo · Fictional data. Changes stay in this tab; refresh to reset.</span>
            </div>
          )}
          <button
            type="button"
            className="icon-button mobile-only menu-button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Bars3Icon />
          </button>
          {error && (
            <div className="banner is-error" role="alert">
              <span>{error}</span>
              <button type="button" className="text-button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {snapshot.transactions.length ? (
            content(snapshot)
          ) : (
            <Data snapshot={snapshot} onImport={openImport} />
          )}
        </main>
        {importing && (
          <ImportDialog
            onClose={() => setImporting(false)}
            onDone={() => {
              setImporting(false);
              void refresh();
            }}
          />
        )}
      </div>
    </AccountsContext>
  );
}
