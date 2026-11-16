import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";

console.log("[start-server] Ensuring local D1 database schema is up-to-date...");
const migrate = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "dist/server/wrangler.json",
    "--persist-to",
    ".wrangler/state",
    "--file",
    "drizzle/0000_messy_blazing_skull.sql",
  ],
  { stdio: "inherit" }
);

if (migrate.error) {
  console.error("[start-server] Migration error:", migrate.error);
}

console.log(`[start-server] Starting server on ${host}:${port}...`);
const server = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "dist/server/wrangler.json",
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--ip",
    host,
    "--port",
    port,
    "--inspector-port",
    "0",
  ],
  { stdio: "inherit" }
);

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
