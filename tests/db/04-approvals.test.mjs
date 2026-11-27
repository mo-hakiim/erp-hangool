// Approvals engine: no self-approval, step order, threshold, project scope, locked statuses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inTx, U, P } from "./helpers.mjs";

const SUPPLIER = "a1000000-0000-4000-8000-000000000001";
const BANK = "b1000000-0000-4000-8000-000000000001";

async function steps(db, group) {
  await db.admin();
  return db.q(
    `select a.id, a.step_order, a.status, r.code as role from approvals a join roles r on r.id = a.required_role_id
     where request_group = $1 order by step_order`, [group]);
}

async function newSupplierPayment(db, amount, by = "procurement") {
  await db.admin();
  const { id } = await db.one(
    `insert into supplier_payments (supplier_id, bank_account_id, recorded_by, amount, method)
     values ($1, $2, $3, $4, 'bank') returning id`, [SUPPLIER, BANK, U[by], amount]);
  return id;
}

async function request(db, who, type, table, id, title = "test", amount = null, version = null) {
  await db.as(who);
  const r = await db.attempt("select public.request_approval($1, $2, $3, $4, $5, $6) as g", [type, table, id, title, amount, version]);
  if (r.error) throw r.error;
  return r.rows[0].g;
}

async function decide(db, who, stepId, approve, comment = null) {
  await db.as(who);
  return db.attempt("select public.decide_approval($1, $2, $3)", [stepId, approve, comment]);
}

test("threshold: below it needs finance only; above it needs finance then owner", () =>
  inTx(async (db) => {
    const small = await newSupplierPayment(db, 4000);
    const big = await newSupplierPayment(db, 9000);
    const g1 = await request(db, "procurement", "payment", "supplier_payments", small);
    const g2 = await request(db, "procurement", "payment", "supplier_payments", big, "big", 1); // tries to understate
    assert.deepEqual((await steps(db, g1)).map((s) => s.role), ["finance"]);
    assert.deepEqual((await steps(db, g2)).map((s) => s.role), ["finance", "owner"]);
    const a = await db.one("select amount from approvals where request_group = $1 limit 1", [g2]);
    assert.equal(Number(a.amount), 9000, "amount comes from the record, not the caller");
  }));

test("steps go in order and the payment is approved only after the last step", () =>
  inTx(async (db) => {
    const big = await newSupplierPayment(db, 12000);
    const g = await request(db, "procurement", "payment", "supplier_payments", big);
    const [s1, s2] = await steps(db, g);
    const early = await decide(db, "owner", s2.id, true);
    assert.match(String(early.error?.message), /earlier step/);
    assert.equal((await decide(db, "finance", s1.id, true)).error, null);
    await db.admin();
    assert.equal((await db.one("select status from supplier_payments where id = $1", [big])).status, "pending");
    assert.equal((await decide(db, "owner", s2.id, true)).error, null);
    await db.admin();
    assert.equal((await db.one("select status from supplier_payments where id = $1", [big])).status, "approved");
    const ov = await db.one("select overall_status from approval_requests where request_group = $1", [g]);
    assert.equal(ov.overall_status, "approved");
  }));

test("nobody approves their own request: the step is skipped and goes to the next approver", () =>
  inTx(async (db) => {
    // Finance requests a small payment: their finance step is skipped -> owner decides.
    const small = await newSupplierPayment(db, 3000, "finance");
    const g = await request(db, "finance", "payment", "supplier_payments", small);
    const s = await steps(db, g);
    assert.deepEqual(s.map((x) => [x.role, x.status]), [["finance", "skipped"], ["owner", "pending"]]);
    // Even another finance person cannot take the owner step.
    assert.match(String((await decide(db, "accountant", s[1].id, true)).error?.message), /owner role/);

    // Someone with finance + owner requests: both skipped -> general manager.
    await db.admin();
    await db.q("insert into user_roles (user_id, role_id, assigned_by) select $1, id, $1 from roles where code = 'finance'", [U.owner]);
    const p2 = await newSupplierPayment(db, 20000, "owner");
    const g2 = await request(db, "owner", "payment", "supplier_payments", p2);
    const s2 = await steps(db, g2);
    assert.deepEqual(s2.map((x) => [x.role, x.status]), [["finance", "skipped"], ["owner", "skipped"], ["general_manager", "pending"]]);
    const self = await decide(db, "owner", s2[2].id, true);
    assert.ok(self.error, "owner must not approve their own request");
  }));

test("the requester cannot decide, and one person cannot approve two steps", () =>
  inTx(async (db) => {
    await db.admin();
    // give the owner the finance role too
    await db.q("insert into user_roles (user_id, role_id, assigned_by) select $1, id, $1 from roles where code = 'finance'", [U.owner]);
    const big = await newSupplierPayment(db, 15000);
    const g = await request(db, "procurement", "payment", "supplier_payments", big);
    const [s1, s2] = await steps(db, g);
    assert.equal((await decide(db, "owner", s1.id, true)).error, null);
    const twice = await decide(db, "owner", s2.id, true);
    assert.match(String(twice.error?.message), /another person/);

    // Leave: the employee cannot decide their own request.
    await db.admin();
    const leave = await db.one("select request_group from approvals where entity_table = 'leave_requests' limit 1");
    const [ls] = await steps(db, leave.request_group);
    const own = await decide(db, "employee", ls.id, true);
    assert.ok(own.error);
  }));

test("rejecting needs a reason, cancels later steps and updates the record", () =>
  inTx(async (db) => {
    const big = await newSupplierPayment(db, 11000);
    const g = await request(db, "procurement", "payment", "supplier_payments", big);
    const [s1] = await steps(db, g);
    assert.match(String((await decide(db, "finance", s1.id, false, "  ")).error?.message), /reason/);
    assert.equal((await decide(db, "finance", s1.id, false, "Supplier price too high")).error, null);
    const after = await steps(db, g);
    assert.deepEqual(after.map((x) => x.status), ["rejected", "cancelled"]);
    assert.equal((await db.one("select status from supplier_payments where id = $1", [big])).status, "rejected");
    const n = await db.one(
      "select count(*)::int n from notifications where user_id = $1 and entity_id = $2 and title like 'Rejected%'", [U.procurement, g]);
    assert.equal(n.n, 1, "requester is told");
  }));

test("statuses that need approval cannot be set directly", () =>
  inTx(async (db) => {
    const p = await newSupplierPayment(db, 500);
    await db.as("finance");
    const direct = await db.attempt("update supplier_payments set status = 'approved' where id = $1", [p]);
    assert.match(String(direct.error?.message), /Approvals Center/);
    const paid = await db.attempt("update supplier_payments set status = 'paid' where id = $1", [p]);
    assert.match(String(paid.error?.message), /approved before/);
    await db.as("owner");
    const own = await db.attempt("update purchase_orders set status = 'approved' where status = 'waiting'");
    assert.equal(own.error, null); // no rows waiting in the seed — and when there are, the guard raises
    await db.as("pm");
    const st = await db.attempt("update stages set status = 'verified' where project_id = $1 and seq = 3", [P.villa]);
    assert.match(String(st.error?.message), /Approvals Center/);
  }));

test("project approvals: only that project's manager can decide the PM step", () =>
  inTx(async (db) => {
    await db.admin();
    const mr = await db.one("select request_group from approvals where entity_table = 'material_requests' limit 1");
    const [s] = await steps(db, mr.request_group);
    assert.equal(s.role, "project_manager");
    const wrong = await decide(db, "pm2", s.id, true);
    assert.match(String(wrong.error?.message), /assigned to this project/);
    await db.as("pm2");
    assert.equal(await db.count("approvals", "request_group = $1", [mr.request_group]), 0, "pm2 cannot even see it");
    assert.equal((await decide(db, "pm", s.id, true)).error, null);
    await db.admin();
    assert.equal((await db.one("select status from material_requests where id = 'b3000000-0000-4000-8000-000000000001'")).status, "pm_approved");
  }));

test("stage completion, BOQ, change request and leave outcomes are applied", () =>
  inTx(async (db) => {
    await db.admin();
    const groups = await db.q(`select distinct a.request_group, a.entity_table from approvals a
      where a.status = 'pending' and a.entity_table <> 'stages'`);
    const g = Object.fromEntries(groups.map((x) => [x.entity_table, x.request_group]));

    // Stage completion requested by PM2 (PM step skipped) -> owner. Made fresh here so the test
    // does not depend on what was decided in the demo data.
    await db.q("select set_config('app.approval_engine', 'off', true)");
    await db.q("update stages set status = 'done', progress_pct = 100 where project_id = $1 and seq = 1", [P.block]);
    await db.q("update approvals set status = 'cancelled' where entity_table = 'stages' and status = 'pending' and entity_id = (select id from stages where project_id = $1 and seq = 1)", [P.block]);
    const stageId = (await db.one("select id from stages where project_id = $1 and seq = 1", [P.block])).id;
    g.stages = await request(db, "pm2", "stage_completion", "stages", stageId, "Foundation complete (test)");
    const st = await steps(db, g.stages);
    assert.deepEqual(st.map((x) => [x.role, x.status]), [["project_manager", "skipped"], ["owner", "pending"]]);
    assert.equal((await decide(db, "owner", st[1].id, true)).error, null);
    await db.admin();
    assert.equal((await db.one("select status from stages where project_id = $1 and seq = 1", [P.block])).status, "verified");

    // BOQ v1 for the commercial block: PM2 (its manager) then owner
    const boq = await steps(db, g.boq);
    assert.equal((await decide(db, "pm2", boq[0].id, true)).error, null);
    assert.equal((await decide(db, "owner", boq[1].id, true)).error, null);
    await db.admin();
    assert.equal(await db.count("boq_items", "project_id = $1 and status <> 'approved'", [P.block]), 0);
    const budget = await db.one("select sum(budget_amount)::numeric b from stages where project_id = $1", [P.block]);
    assert.equal(Number(budget.b), 5 * 22000);

    // Change request raised by the client -> PM -> owner. Client can follow it; other client cannot.
    await db.as("clientA");
    assert.ok((await db.count("approvals", "request_group = $1", [g.change_requests])) > 0);
    await db.as("clientB");
    assert.equal(await db.count("approvals", "request_group = $1", [g.change_requests]), 0);
    const cr = await steps(db, g.change_requests);
    assert.equal((await decide(db, "pm", cr[0].id, true)).error, null);
    assert.equal((await decide(db, "owner", cr[1].id, true)).error, null);
    await db.admin();
    assert.equal((await db.one("select status from change_requests where id = 'b5000000-0000-4000-8000-000000000001'")).status, "approved");

    // Leave -> HR
    const lv = await steps(db, g.leave_requests);
    assert.equal((await decide(db, "hr", lv[0].id, true)).error, null);
    await db.admin();
    assert.equal((await db.one("select status from leave_requests where id = 'b4000000-0000-4000-8000-000000000001'")).status, "approved");
  }));

test("approvers are notified, and the same item cannot be requested twice", () =>
  inTx(async (db) => {
    const p = await newSupplierPayment(db, 8000);
    const g = await request(db, "procurement", "payment", "supplier_payments", p, "Notify test");
    await db.admin();
    const n = await db.one("select count(*)::int n from notifications where entity_id = $1 and user_id = $2", [g, U.finance]);
    assert.equal(n.n, 1);
    const n2 = await db.one("select count(*)::int n from notifications where entity_id = $1 and user_id = $2", [g, U.procurement]);
    assert.equal(n2.n, 0, "the requester is not asked to approve");
    await db.as("procurement");
    const dup = await db.attempt("select public.request_approval('payment', 'supplier_payments', $1, 'again')", [p]);
    assert.match(String(dup.error?.message), /already waiting/);
  }));

test("internal functions cannot be called from the app", () =>
  inTx(async (db) => {
    await db.as("finance");
    for (const sql of [
      "select public._apply_approval_outcome(gen_random_uuid(), true)",
      "select public.post_journal(current_date, 'x', null, null, '[]'::jsonb)",
      "select public.notify(gen_random_uuid(), 'x')",
    ]) {
      const r = await db.attempt(sql);
      assert.match(String(r.error?.message), /permission denied/, sql);
    }
  }));
