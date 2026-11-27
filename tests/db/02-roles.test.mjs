// Each staff role sees only its own area; project roles only their assigned projects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inTx, U, P } from "./helpers.mjs";

async function totals(db) {
  await db.admin();
  const t = {};
  for (const x of ["projects", "invoices", "employees", "journal_entries", "leads", "suppliers", "properties", "audit_log"]) {
    t[x] = await db.count(x);
  }
  return t;
}

test("owner and general manager see everything", () =>
  inTx(async (db) => {
    const all = await totals(db);
    for (const who of ["owner", "gm"]) {
      await db.as(who);
      for (const [table, n] of Object.entries(all)) {
        assert.equal(await db.count(table), n, `${who} should see all ${table}`);
      }
    }
  }));

const expectations = {
  finance:     { projects: "all", invoices: "all", journal_entries: "all", employees: "all", leads: "all", suppliers: "all", audit_log: 0 },
  accountant:  { projects: "all", invoices: "all", journal_entries: "all", leads: 0, properties: 0, audit_log: 0 },
  hr:          { employees: "all", invoices: 0, journal_entries: 0, leads: 0, suppliers: 0 },
  procurement: { suppliers: "all", invoices: 0, employees: 1, journal_entries: 0, leads: 0 },
  store:       { suppliers: "all", invoices: 0, employees: 1, journal_entries: 0 },
  marketing:   { leads: "all", properties: "all", projects: 0, invoices: 0, employees: 1 },
  realestate:  { properties: "all", leads: "all", projects: 0, invoices: 0, journal_entries: 0 },
  engineer:    { projects: "assigned", invoices: 0, employees: 1, journal_entries: 0, leads: 0 },
  engineer2:   { projects: "assigned", invoices: 0, journal_entries: 0 },
  supervisor:  { projects: "assigned", invoices: 0, journal_entries: 0 },
  qs:          { projects: "assigned", invoices: 0 },
  architect:   { projects: "assigned", invoices: 0 },
  pm:          { projects: "assigned", journal_entries: 0, leads: 0 },
  pm2:         { projects: "assigned", journal_entries: 0 },
  employee:    { projects: 0, invoices: 0, employees: 1, journal_entries: 0, leads: 0, suppliers: 0 },
};

test("each role's visibility matches the permission matrix", () =>
  inTx(async (db) => {
    const all = await totals(db);
    // Projects a person works on (manager or member), counted as admin: project roles must see exactly these.
    const assigned = {};
    for (const who of Object.keys(expectations)) {
      assigned[who] = (await db.one(
        `select count(*)::int n from projects p where p.manager_id = $1
           or exists (select 1 from project_members m where m.project_id = p.id and m.user_id = $1)`, [U[who]])).n;
    }
    for (const [who, exp] of Object.entries(expectations)) {
      await db.as(who);
      for (const [table, want] of Object.entries(exp)) {
        const n = await db.count(table);
        const expected = want === "all" ? all[table] : want === "assigned" ? assigned[who] : want;
        assert.equal(n, expected, `${who} → ${table}`);
      }
      await db.admin();
    }
  }));

test("project roles are limited to their projects", () =>
  inTx(async (db) => {
    await db.as("engineer");
    assert.equal(await db.count("projects", "id = $1", [P.block]), 0);
    assert.equal(await db.count("daily_reports", "project_id = $1", [P.block]), 0);
    assert.equal(await db.count("site_attendance", "project_id = $1", [P.block]), 0);
    const own = await db.attempt(
      "insert into daily_reports (project_id, author_id, report_date, progress) values ($1, $2, current_date, 'ok')", [P.villa, U.engineer]);
    assert.equal(own.error, null, own.error?.message);
    const other = await db.attempt(
      "insert into daily_reports (project_id, author_id, report_date, progress) values ($1, $2, current_date, 'x')", [P.block, U.engineer]);
    assert.ok(other.error, "engineer must not report on another project");

    await db.as("qs");
    assert.ok((await db.count("boq_items", "project_id = $1", [P.villa])) > 0);
    assert.equal(await db.count("boq_items", "project_id = $1", [P.block]), 0);

    await db.as("pm2");
    assert.equal(await db.count("projects", "id = $1", [P.villa]), 0);
    const upd = await db.attempt("update projects set name = name where id = $1", [P.villa]);
    assert.equal(upd.rowCount, 0);
  }));

test("write rights follow the role", () =>
  inTx(async (db) => {
    const item = "a2000000-0000-4000-8000-000000000005";
    await db.as("store");
    const ok = await db.attempt(
      "insert into stock_movements (item_id, direction, quantity, recorded_by) values ($1, 'in', 5, $2)", [item, U.store]);
    assert.equal(ok.error, null, ok.error?.message);
    await db.as("engineer");
    const no = await db.attempt(
      "insert into stock_movements (item_id, direction, quantity, recorded_by) values ($1, 'in', 5, $2)", [item, U.engineer]);
    assert.ok(no.error, "engineer must not move stock");
    await db.as("marketing");
    const inv = await db.attempt(
      "insert into invoices (project_id, client_id, amount) values ($1, 'e0000000-0000-4000-8000-000000000001', 5)", [P.villa]);
    assert.ok(inv.error, "marketing must not create invoices");
    await db.as("hr");
    const emp = await db.attempt("update employees set base_salary = base_salary where true");
    assert.ok(emp.rowCount > 0);
    await db.as("finance");
    const emp2 = await db.attempt("update employees set base_salary = 1 where true");
    assert.equal(emp2.rowCount, 0, "finance can read but not change employees");
  }));

test("employees see only their own HR records and cannot approve their own leave", () =>
  inTx(async (db) => {
    await db.as("employee");
    assert.equal(await db.count("payroll", "employee_id <> public.my_employee_id()"), 0);
    assert.ok((await db.count("payroll")) >= 1);
    assert.equal(await db.count("leave_requests", "employee_id <> public.my_employee_id()"), 0);
    assert.equal(await db.count("site_attendance", "employee_id is distinct from public.my_employee_id()"), 0);
    const r = await db.attempt("update leave_requests set status = 'approved' where employee_id = public.my_employee_id()");
    assert.ok(r.error, "employee must not approve own leave");
  }));

test("staff directory hides salaries but lists colleagues", () =>
  inTx(async (db) => {
    await db.as("engineer");
    assert.ok((await db.count("employee_directory")) > 5);
    const cols = Object.keys((await db.q("select * from employee_directory limit 1"))[0]);
    assert.ok(!cols.includes("base_salary"));
    await db.as("clientA");
    assert.equal(await db.count("employee_directory"), 0);
  }));

test("2FA: a user with a verified TOTP factor sees nothing until the session is aal2", () =>
  inTx(async (db) => {
    await db.admin();
    await db.q(
      `insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
       values (gen_random_uuid(), $1, 'test', 'totp', 'verified', now(), now(), 'x')`, [U.finance]);
    await db.as("finance", "aal1");
    assert.equal(await db.count("invoices"), 0);
    assert.equal(await db.one("select public.is_staff() as s").then((r) => r.s), false);
    await db.as("finance", "aal2");
    assert.ok((await db.count("invoices")) > 0);
  }));
