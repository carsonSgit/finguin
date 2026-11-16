import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const guard = resolve(import.meta.dir, "../scripts/check-privacy.ts");

test("privacy gate accepts source and rejects forced private files and historical secrets", () => {
  const cwd = mkdtempSync(join(tmpdir(), "finguin-privacy-"));
  const run = (...args: string[]) => Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  const git = (...args: string[]) => {
    const result = run("git", ...args);
    expect(result.exitCode).toBe(0);
  };
  const stage = (path: string, content: string) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
    git("add", "--force", "--", path);
  };
  const check = (...args: string[]) => run("bun", guard, ...args).exitCode;
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "commit.gpgsign", "false");
    stage("src/demo.ts", "export const demo = 1;\n");
    expect(check()).toBe(0);
    git("commit", "-m", "Synthetic source");
    for (const path of [".env.local", "data/export.csv", "server/renamed.db"]) {
      stage(path, "synthetic private file");
      expect(check()).toBe(1);
      git("rm", "--cached", "--", path);
    }
    stage("src/secret.ts", `const key = "${"sk-"}${"x".repeat(32)}";`);
    expect(check()).toBe(1);
    git("commit", "-m", "Synthetic secret for rejection test");
    git("rm", "--", "src/secret.ts");
    git("commit", "-m", "Delete synthetic secret");
    expect(check()).toBe(0);
    expect(check("--history")).toBe(1);
    stage("src/disguised.ts", "SQLite format 3\0synthetic");
    expect(check()).toBe(1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
