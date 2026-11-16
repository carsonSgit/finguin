import { posix } from "node:path";

function git(...args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString();
}

const roots = new Set([
  "public/emoji/LICENSE",
  ".gitignore",
  ".env.example",
  "README.md",
  "LICENSE",
  "package.json",
  "bun.lock",
  "biome.json",
  "components.json",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
  "vendor/bklit/src/charts/patterns/LICENSE-visx-pattern",
]);
const secret =
  /-----BEGIN (?:\w+ )*PRIVATE KEY-----|\bsk-(?:or-v1-)?[a-zA-Z0-9_-]{20,}|\b(?:ghp|glpat|github_pat)[_-][a-zA-Z0-9_-]{20,}|(?:API_KEY|SECRET|PASSWORD|TOKEN)\s*[=:]\s*["']?[a-zA-Z0-9_/-]{20,}/;
const checked = new Set<string>();
let failures = 0;
function check(mode: string, oid: string, path: string) {
  const key = `${oid}:${path}`;
  if (checked.has(key)) return;
  checked.add(key);
  const parts = path.split("/");
  const name = posix.basename(path);
  const allowed =
    roots.has(path) ||
    /^(src|server|scripts|tests)\/.+\.(ts|tsx|css)$/.test(path) ||
    /^public\/emoji\/[a-z-]+\.png$/.test(path) ||
    /^\.githooks\/(pre-commit|pre-push)$/.test(path) ||
    /^vendor\/bklit\/(src\/.+\.(ts|tsx)|README\.md|LICENSE|package\.json|tsconfig\.json)$/.test(path);
  const forbidden =
    parts.some((p) => /^(data|imports|exports|backups|logs|node_modules|dist)$/.test(p)) ||
    (name.startsWith(".env") && path !== ".env.example");
  const content = git("cat-file", "blob", oid);
  if (
    !allowed ||
    forbidden ||
    !["100644", "100755"].includes(mode) ||
    content.startsWith("SQLite format 3") ||
    secret.test(content)
  ) {
    console.error(`Privacy check rejected: ${path}`);
    failures++;
  }
}

if (process.argv.includes("--history")) {
  for (const commit of git("rev-list", "--all").trim().split("\n").filter(Boolean)) {
    for (const entry of git("ls-tree", "-rz", commit).split("\0").filter(Boolean)) {
      const [metadata, path] = entry.split("\t");
      const [mode, , oid] = metadata?.split(" ") ?? [];
      if (!mode || !oid || !path) throw new Error("Invalid tree entry");
      check(mode, oid, path);
    }
  }
} else {
  for (const entry of git("ls-files", "--stage", "-z").split("\0").filter(Boolean)) {
    const [metadata, path] = entry.split("\t");
    const [mode, oid, stage] = metadata?.split(" ") ?? [];
    if (!mode || !oid || !path || stage !== "0") throw new Error("Unmerged or invalid index entry");
    check(mode, oid, path);
  }
}
console.log(`Privacy check: ${checked.size} file versions, ${failures} rejected`);
process.exitCode = failures ? 1 : 0;
