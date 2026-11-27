// Clients must only ever see their own data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inTx, U, P, C } from "./helpers.mjs";

test("client A sees only their own projects, invoices, payments and client row", () =>
  inTx(async (db) => {
    await db.admin();
    const own = (await db.q("select id from projects where client_id = $1", [C.A])).map((r) => r.id).sort();
    assert.ok(own.includes(P.villa) && own.includes(P.wall));
    await db.as("clientA");
    const projects = (await db.q("select id from projects order by code")).map((r) => r.id);
    assert.deepEqual(projects.sort(), own);
    assert.equal(await db.count("projects", "client_id <> $1", [C.A]), 0);
    assert.equal(await db.count("clients"), 1);
    assert.equal(await db.count("invoices", "client_id <> $1", [C.A]), 0);
    assert.ok((await db.count("invoices")) > 0);
    assert.equal(await db.count("invoices", "status = 'draft'"), 0);
    assert.equal(await db.count("payments", "client_id <> $1", [C.A]), 0);
    assert.equal(await db.count("contracts", "client_id <> $1", [C.A]), 0);
    assert.equal(await db.count("stages", "project_id <> all($1::uuid[])", [own]), 0);
    assert.ok((await db.count("stages")) > 0);
  }));

test("client B cannot see any of client A's data (and the other way round)", () =>
  inTx(async (db) => {
    await db.as("clientB");
    assert.equal(await db.count("projects", "client_id = $1", [C.A]), 0);
    assert.equal(await db.count("invoices", "client_id = $1", [C.A]), 0);
    assert.equal(await db.count("payments", "client_id = $1", [C.A]), 0);
    assert.equal(await db.count("messages", "client_id = $1", [C.A]), 0);
    assert.equal(await db.count("clients", "id = $1", [C.A]), 0);
    assert.equal(await db.count("daily_reports", "project_id = $1", [P.villa]), 0);
    // B's own draft invoice is hidden from B too
    assert.equal(await db.count("invoices", "status = 'draft'"), 0);
    await db.as("clientA");
    assert.equal(await db.count("complaints"), 0); // the only complaint is B's
    assert.equal(await db.count("projects", "id = $1", [P.block]), 0);
  }));

test("clients only see daily reports marked visible to them", () =>
  inTx(async (db) => {
    await db.admin();
    const visible = await db.count("daily_reports", "project_id = $1 and visible_to_client", [P.villa]);
    const all = await db.count("daily_reports", "project_id = $1", [P.villa]);
    assert.ok(all > visible);
    await db.as("clientA");
    assert.equal(await db.count("daily_reports"), visible);
  }));

test("clients see none of the internal tables", () =>
  inTx(async (db) => {
    await db.as("clientA");
    for (const t of ["boq_items", "suppliers", "employees", "payroll", "journal_entries", "journal_lines",
      "audit_log", "leads", "campaigns", "bank_accounts", "expenses", "purchase_orders", "inventory_items",
      "stock_movements", "site_attendance", "labourers", "tenants", "rental_agreements", "chart_of_accounts"]) {
      assert.equal(await db.count(t), 0, `client should not see ${t}`);
    }
    assert.equal(await db.count("user_roles", "user_id <> $1", [U.clientA]), 0);
    assert.equal(await db.count("notifications", "user_id <> $1", [U.clientA]), 0);
  }));

test("clients cannot create or change finance / project records", () =>
  inTx(async (db) => {
    await db.as("clientA");
    const ins = await db.attempt(
      "insert into invoices (project_id, client_id, amount, status) values ($1, $2, 10, 'pending')", [P.villa, C.A]);
    assert.ok(ins.error, "client must not create invoices");
    const upd = await db.attempt("update projects set name = 'hacked' where id = $1", [P.villa]);
    assert.equal(upd.rowCount, 0);
    const pay = await db.attempt("update payments set amount = 1 where client_id = $1", [C.A]);
    assert.equal(pay.rowCount, 0);
    const msg = await db.attempt("insert into messages (client_id, sender_id, body) values ($1, $2, 'hi')", [C.B, U.clientA]);
    assert.ok(msg.error, "client must not message as another client");
    const cr = await db.attempt(
      "insert into change_requests (project_id, requested_by, description) values ($1, $2, 'x')", [P.block, U.clientA]);
    assert.ok(cr.error, "client must not raise change requests on someone else's project");
    const own = await db.attempt(
      "insert into change_requests (project_id, requested_by, description) values ($1, $2, 'paint the gate')", [P.villa, U.clientA]);
    assert.equal(own.error, null, own.error?.message);
  }));

test("documents: shared with the client role only for the client's own project", () =>
  inTx(async (db) => {
    await db.as("clientA");
    assert.equal(await db.count("documents"), 1); // the villa permit
    assert.equal(await db.count("document_versions"), 1);
    await db.as("clientB");
    assert.equal(await db.count("documents"), 0);
  }));

test("not signed in (anon) sees nothing", () =>
  inTx(async (db) => {
    await db.anon();
    // Depending on the project's Data API settings anon either has no table privileges at all
    // (permission denied) or has them but RLS returns no rows. Both mean: nothing is visible.
    for (const t of ["projects", "clients", "invoices", "profiles", "settings", "roles", "approvals"]) {
      const r = await db.attempt(`select count(*)::int as n from ${t}`);
      if (r.error) assert.match(r.error.message, /permission denied/, t);
      else assert.equal(r.rows[0].n, 0, `anon should not see ${t}`);
    }
    for (const fn of ["select public.request_approval('leave', 'leave_requests', gen_random_uuid(), 'x')",
                      "select public.decide_approval(gen_random_uuid(), true, null)"]) {
      const r = await db.attempt(fn);
      assert.ok(r.error, `anon must not be able to run: ${fn}`);
    }
  }));
