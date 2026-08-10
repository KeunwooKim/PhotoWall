#!/usr/bin/env node
/**
 * PM2 entry: refuse to boot Next without a production BUILD_ID.
 * Prevents the restart-loop that leaves photowall in `errored` with no listener.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const buildIdPath = path.join(root, ".next", "BUILD_ID");

if (!fs.existsSync(buildIdPath)) {
  console.error(
    "[pm2-run-next] Refusing to start: missing .next/BUILD_ID. Run `npm run build` (or scripts/start-production.sh) first.",
  );
  process.exit(1);
}

const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
if (!buildId) {
  console.error("[pm2-run-next] Refusing to start: empty BUILD_ID");
  process.exit(1);
}

console.log(`[pm2-run-next] starting next (BUILD_ID=${buildId})`);

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "start"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
