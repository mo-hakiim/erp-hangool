// Double-entry ledger, invoice status, stock rules, offline sync.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inTx, U, P, C } from "./helpers.mjs";

test("every posted journal entry balances", () =>
  inTx(async (db) => {
    await db.admin();
    const bad = await db.q(`
      select e.id from journal_entries e join journal_lines l on l.entry_id = e.id
      where e.status = 'posted' group by e.id having sum(l.debit) <> sum(l.credit)`);
    assert.equal(bad.length, 0);
    assert.ok((await db.count("journal_entries", "status = 'posted'")) > 5);
  }));

test("an unbalanced entry cannot be posted, and posted lines are locked", () =>
  inTx(async (db) => {
    await db.as("accountant");
    const { id } = await db.one("insert into journal_entries (memo) values ('test') returning id");
    await db.q("insert into journal_lines (entry_id, account_id, debit) values ($1, public.acct('1000'), 100)", [id]);
    const post = await db.attempt("update journal_entries set status = 'posted' where id = $1", [id]);
    assert.match(String(post.error?.message), /does not balance/);
    await db.q("insert into journal_lines (entry_id, account_id, credit) values ($1, public.acct('3000'), 100)", [id]);
    assert.equal((await db.attempt("update journal_entries set status = 'posted' where id = $1", [id])).error, null);
    const edit = await db.attempt("update journal_lines set debit = 5 where entry_id = $1", [id]);
    assert.match(String(edit.error?.message), /cannot be changed/);
  }));

test("invoice goes pending -> partially_paid -> paid as payments are confirmed, and posts to the ledger", () =>
  inTx(async (db) => {
    await db.as("finance");
    const inv = await db.one(
      `insert into invoices (project_id, client_id, invoice_type, amount, due_date, status)
       values ($1, $2, 'extra', 1000, current_date + 10, 'pending') returning id, invoice_no`, [P.villa, C.A]);
    assert.match(inv.invoice_no, /^INV-\d{4}-\d{4}$/);
    const je = await db.one(
      `select sum(l.debit)::numeric d from journal_entries e join journal_lines l on l.entry_id = e.id
       where e.source_table = 'invoices' and e.source_id = $1 and e.status = 'posted'`, [inv.id]);
    assert.equal(Number(je.d), 1000);
    const pay = (amt) => db.q(
      `insert into payments (client_id, project_id, invoice_id, recorded_by, payment_type, amount, method, status)
       values ($1, $2, $3, $4, 'extra', $5, 'zaad', 'confirmed')`, [C.A, P.villa, inv.id, U.finance, amt]);
    await pay(400);
    assert.equal((await db.one("select status from invoices where id = $1", [inv.id])).status, "partially_paid");
    await pay(600);
    const done = await db.one("select status, amount_paid from invoices where id = $1", [inv.id]);
    assert.equal(done.status, "paid");
    assert.equal(Number(done.amount_paid), 1000);
  }));

test("several invoices per stage are allowed (deposit, milestone and extra)", () =>
  inTx(async (db) => {
    await db.as("finance");
    const stage = (await db.one("select id from stages where project_id = $1 and seq = 4", [P.villa])).id;
    for (const t of ["milestone", "extra", "extra"]) {
      const r = await db.attempt(
        "insert into invoices (project_id, stage_id, client_id, invoice_type, amount) values ($1, $2, $3, $4, 100)", [P.villa, stage, C.A, t]);
      assert.equal(r.error, null, r.error?.message);
    }
  }));

test("overdue job marks unpaid invoices past their due date", () =>
  inTx(async (db) => {
    await db.as("finance");
    const { id } = await db.one(
      "insert into invoices (project_id, client_id, amount, due_date, status) values ($1, $2, 50, current_date - 1, 'pending') returning id", [P.villa, C.A]);
    await db.admin();
    await db.q("select public.mark_overdue_invoices()");
    assert.equal((await db.one("select status from invoices where id = $1", [id])).status, "overdue");
  }));

test("stock can never go below zero", () =>
  inTx(async (db) => {
    await db.as("store");
    const item = "a2000000-0000-4000-8000-000000000006";
    const { qty_on_hand } = await db.one("select qty_on_hand from inventory_items where id = $1", [item]);
    const r = await db.attempt(
      "insert into stock_movements (item_id, direction, quantity, recorded_by) values ($1, 'out', $2, $3)", [item, Number(qty_on_hand) + 1, U.store]);
    assert.ok(r.error, "issuing more than on hand must fail");
    await db.q("insert into stock_movements (item_id, direction, quantity, recorded_by) values ($1, 'out', 1, $2)", [item, U.store]);
    const after = await db.one("select qty_on_hand from inventory_items where id = $1", [item]);
    assert.equal(Number(after.qty_on_hand), Number(qty_on_hand) - 1);
  }));

test("offline sync: device uuid is unique and synced_at is stamped", () =>
  inTx(async (db) => {
    await db.as("supervisor");
    const dev = "11111111-2222-4333-8444-555555555555";
    const ins = (lat) => db.attempt(
      `insert into site_attendance (project_id, labourer_id, recorded_by, work_date, check_in_lat, check_in_lng, client_id, device_id, happened_at)
       values ($1, 'a9000000-0000-4000-8000-000000000004', $2, current_date, $3, 44.07, $4, 'phone-x', now() - interval '2 hours')`,
      [P.villa, U.supervisor, lat, dev]);
    assert.equal((await ins(9.56)).error, null);
    const again = await ins(9.56);
    assert.match(String(again.error?.message), /duplicate key/);
    const row = await db.one("select synced_at, happened_at from site_attendance where client_id = $1", [dev]);
    assert.ok(row.synced_at > row.happened_at);
  }));
