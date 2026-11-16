import { createContext, useContext } from "react";
import type { AccountId, AccountSummary } from "../domain/types";

export const AccountsContext = createContext<ReadonlyMap<AccountId, AccountSummary>>(new Map());

export function useAccountName() {
  const accounts = useContext(AccountsContext);
  return (id: AccountId | null) => (id ? (accounts.get(id)?.name ?? id) : "");
}
