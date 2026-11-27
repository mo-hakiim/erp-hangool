// Test helpers: every test runs inside a transaction that is rolled back,
// so the database is left exactly as it was (seed data stays intact).
import { connect } from "../../scripts/db.mjs";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const U = {
  owner: id(1), gm: id(2), finance: id(3), accountant: id(4), hr: id(5), procurement: id(6),
  store: id(7), pm: id(8), engineer: id(9), supervisor: id(10), qs: id(11), architect: id(12),
  marketing: id(13), realestate: id(14), employee: id(15), clientA: id(16), clientB: id(17),
  pm2: id(18), engineer2: id(19),
};
export const P = {
  villa: "f0000000-0000-4000-8000-000000000001",
  block: "f0000000-0000-4000-8000-000000000002",
  school: "f0000000-0000-4000-8000-000000000003",
  wall: "f0000000-0000-4000-8000-000000000004",
};
export const C = { A: "e0000000-0000-4000-8000-000000000001", B: "e0000000-0000-4000-8000-000000000002" };

let sp = 0;

function wrap(client) {
  const db = {
    raw: client,
    /** Run as a signed-in user (by key of U), with session assurance level aal1/aal2. */
    async as(who, aal = "aal1") {
      await client.query("reset role");
      const sub = U[who] ?? who;
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub, role: "authenticated", aal }),
      ]);
      await client.query("set local role authenticated");
      return db;
    },
    async anon() {
      await client.query("reset role");
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
      await client.query("set local role anon");
      return db;
    },
    async admin() {
      await client.query("reset role");
      await client.query("select set_config('request.jwt.claims', '', true)");
      return db;
    },
    async q(sql, params) {
      return (await client.query(sql, params)).rows;
    },
    async one(sql, params) {
      return (await client.query(sql, params)).rows[0];
    },
    async count(table, where = "true", params) {
      const r = await client.query(`select count(*)::int as n from ${table} where ${where}`, params);
      return r.rows[0].n;
    },
    /** Runs a statement that may fail, without aborting the transaction. Returns the error or null. */
    async attempt(sql, params) {
      const name = `sp${++sp}`;
      await client.query(`savepoint ${name}`);
      try {
        const r = await client.query(sql, params);
        await client.query(`release savepoint ${name}`);
        return { error: null, rowCount: r.rowCount, rows: r.rows };
      } catch (error) {
        await client.query(`rollback to savepoint ${name}`);
        return { error, rowCount: 0, rows: [] };
      }
    },
  };
  return db;
}

/** Run fn(db) inside a transaction that is always rolled back. */
export async function inTx(fn) {
  const client = await connect();
  try {
    await client.query("begin");
    await fn(wrap(client));
  } finally {
    try { await client.query("rollback"); } catch { /* ignore */ }
    await client.end();
  }
}
