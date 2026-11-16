import { useCallback, useEffect, useState } from "react";
import type { AccountId, Classification, Snapshot, TransactionId } from "./domain/types";
import type { Plan } from "./model";

async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : res.statusText;
    throw new Error(message);
  }
  return res;
}

export const api = {
  reclassify: (id: TransactionId, classification: Classification) =>
    call(`/api/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ classification }) }),
  setHomeShare: (id: AccountId, homeShare: number) =>
    call(`/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ homeShare }) }),
  savePlan: (plan: Plan) => call("/api/plan", { method: "PUT", body: JSON.stringify(plan) }),
  importCsv: async (fileName: string, text: string) => {
    const res = await call("/api/import", { method: "POST", body: JSON.stringify({ fileName, text }) });
    const result: { added: number; read: number; skipped: string[] } = await res.json();
    return result;
  },
};

export type SnapshotState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly snapshot: Snapshot };

export function useSnapshot() {
  const [state, setState] = useState<SnapshotState>({ status: "loading" });
  const refresh = useCallback(async () => {
    try {
      const res = await call("/api/snapshot");
      const snapshot: Snapshot = await res.json();
      setState({ status: "ready", snapshot });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { state, refresh };
}
