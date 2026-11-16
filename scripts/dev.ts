const children = [
  Bun.spawn(["bun", "--watch", "server/index.ts"], { stdout: "inherit", stderr: "inherit" }),
  Bun.spawn(["bunx", "vite", "--host", "127.0.0.1", "--port", "5186", "--strictPort"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
];
const stopAll = () => {
  for (const child of children) child.kill();
};
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
await Promise.race(children.map((c) => c.exited));
stopAll();
process.exit(1);

export {};
