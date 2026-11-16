import { useEffect, useRef, useState } from "react";
import { api } from "../api";

type Result = { readonly file: string } & (
  | { readonly ok: true; readonly added: number; readonly read: number }
  | { readonly ok: false; readonly error: string }
);

export function ImportDialog({
  onClose,
  onDone,
}: {
  readonly onClose: () => void;
  readonly onDone: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<readonly Result[]>([]);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function importFiles(files: readonly File[]) {
    setBusy(true);
    const next: Result[] = [];
    for (const file of files) {
      try {
        const { added, read } = await api.importCsv(file.name, await file.text());
        next.push({ file: file.name, ok: true, added, read });
      } catch (error) {
        next.push({
          file: file.name,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    setResults(next);
    setBusy(false);
  }
  return (
    <dialog ref={ref} className="import-dialog" onClose={results.length ? onDone : onClose}>
      <div className="section-heading">
        <h2>Import Wealthsimple exports</h2>
      </div>
      <label className="upload-zone">
        <strong>{busy ? "Importing…" : "Choose CSV files"}</strong>
        <span className="muted">
          Chequing activity and account activities exports. Duplicates are skipped.
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => void importFiles([...(e.currentTarget.files ?? [])])}
        />
      </label>
      {results.map((r) => (
        <p key={r.file} className={r.ok ? "positive" : "error"}>
          {r.file}: {r.ok ? `${r.read} rows read, ${r.added} new` : r.error}
        </p>
      ))}
      <div className="dialog-footer">
        <button
          type="button"
          className={results.length ? "primary" : ""}
          onClick={() => ref.current?.close()}
        >
          {results.length ? "Done" : "Cancel"}
        </button>
      </div>
    </dialog>
  );
}
