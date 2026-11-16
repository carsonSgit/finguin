import { ArrowDownTrayIcon } from "@heroicons/react/16/solid";
import { isDemo } from "../api";
import { Card, Empty, Screen } from "../components/ui";
import type { Snapshot } from "../domain/types";

export function Data({ snapshot, onImport }: { readonly snapshot: Snapshot; readonly onImport: () => void }) {
  return (
    <Screen
      title="Your data"
      actions={
        <button type="button" className="primary" onClick={onImport}>
          <ArrowDownTrayIcon /> Import CSV
        </button>
      }
    >
      <Card>
        <div className="card-head">
          <h2>{isDemo ? "Fictional demo data" : "Stored on this machine"}</h2>
        </div>
        <p className="muted">
          {isDemo ? (
            "This demo contains fictional accounts and transactions. Changes stay in this tab and reset when you refresh. Run Finguin locally to import your own data."
          ) : (
            <>
              Everything lives in <code>data/finguin.db</code> (SQLite) next to the app. Import Wealthsimple's
              chequing activity and account activities exports; re-importing an overlapping export only adds
              new rows and keeps the categories you've changed. Copy the file to back it up.
            </>
          )}
        </p>
        {!isDemo && (
          <p className="muted">
            From a terminal: <code>bun run import /path/to/export.csv</code>
          </p>
        )}
      </Card>
      <Card>
        <div className="card-head">
          <h2>Import history</h2>
          <span className="muted">{snapshot.transactions.length} transactions</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Format</th>
                <th>Imported</th>
                <th className="align-right">Rows</th>
                <th className="align-right">New</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.imports.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.fileName}</td>
                  <td>{entry.format}</td>
                  <td>{new Date(entry.importedAt).toLocaleString("en-CA")}</td>
                  <td className="align-right">{entry.rowsRead}</td>
                  <td className="align-right">{entry.rowsAdded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot.imports.length && <Empty>No imports yet.</Empty>}
      </Card>
    </Screen>
  );
}
