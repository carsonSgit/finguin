import { basename } from "node:path";
import { importParsed, openDb } from "../server/db";
import { parseWealthsimple } from "../src/import/wealthsimple";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: bun run import <wealthsimple-export.csv>...");
  process.exit(2);
}
const dbPath = process.env["FINGUIN_DB"] ?? `${import.meta.dir}/../data/finguin.db`;
const db = openDb(dbPath);
for (const file of files) {
  const parsed = parseWealthsimple(await Bun.file(file).text());
  const result = importParsed(db, parsed, basename(file));
  console.log(`${basename(file)} (${parsed.format}): ${result.read} rows, ${result.added} new, ${result.skipped.length} skipped`);
  for (const reason of result.skipped) console.log(`  skipped ${reason}`);
}
console.log(`db: ${dbPath}`);
