// Database helper for the Hangool ERP.
//
//   node scripts/db.mjs build   -> writes supabase/schema.sql from supabase/migrations/*.sql
//   node scripts/db.mjs apply   -> runs supabase/schema.sql on the database (safe to re-run)
//   node scripts/db.mjs seed    -> runs supabase/seed.sql (demo data — never on production)
//   node scripts/db.mjs test    -> runs the security / approval tests in tests/db (rolled back)
//
// The connection string is read from SUPABASE_DB_URL (environment or .env.local).
// Supabase dashboard > Connect > "Session pooler" URI. Never commit it.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const schemaFile = join(root, "supabase", "schema.sql");
const seedFile = join(root, "supabase", "seed.sql");

export function loadEnv() {
  const file = join(root, ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  if (!process.env.SUPABASE_DB_URL) {
    console.error("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");
    process.exit(1);
  }
  return process.env.SUPABASE_DB_URL;
}

// postgres(ql)://user:password@host:port/database — the password may contain
// characters like # / ? @ % that are not URL-encoded, so split by hand.
export function parseDbUrl(url) {
  const m = url.trim().match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) throw new Error("SUPABASE_DB_URL should look like postgresql://user:password@host:5432/postgres");
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  return { user: dec(m[1]), password: dec(m[2]), host: m[3], port: Number(m[4] || 5432), database: m[5] };
}

export async function connect() {
  // Optional: a module exporting connect() that returns a pg-compatible client
  // (used for offline dry runs against an in-memory Postgres). Not used with Supabase.
  if (process.env.DB_TEST_ADAPTER) {
    const mod = await import(process.env.DB_TEST_ADAPTER);
    return mod.connect();
  }
  const { default: pg } = await import("pg");
  const url = loadEnv();
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new pg.Client({ ...parseDbUrl(url), ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

function build() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const parts = [
    "-- ============================================================================",
    "-- Hangool ERP · full schema (generated from supabase/migrations by scripts/db.mjs build).",
    "-- Do not edit by hand. Safe to re-run on the same database.",
    "-- ============================================================================",
    "",
  ];
  for (const f of files) {
    parts.push(`-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${f}`, readFileSync(join(migrationsDir, f), "utf8").trim(), "");
  }
  writeFileSync(schemaFile, parts.join("\n"));
  console.log(`schema.sql written from ${files.length} migrations`);
}

async function runFile(file) {
  const client = await connect();
  try {
    await client.query(readFileSync(file, "utf8"));
    console.log(`ran ${file.replace(root, ".")}`);
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const cmd = isMain ? process.argv[2] : undefined;
if (cmd === "build") build();
else if (cmd === "apply") { build(); await runFile(schemaFile); }
else if (cmd === "seed") await runFile(seedFile);
else if (cmd === "test") {
  loadEnv();
  const dir = join(root, "tests", "db");
  const files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join(dir, f));
  const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files], { stdio: "inherit", env: process.env });
  process.exit(r.status ?? 1);
} else if (cmd) {
  console.error(`Unknown command "${cmd}"`);
  process.exit(1);
}
