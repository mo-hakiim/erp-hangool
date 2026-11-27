// Only the owner manages roles and settings; the last owner cannot be removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inTx, U } from "./helpers.mjs";

test("only the owner can change settings", () =>
  inTx(async (db) => {
    for (const who of ["gm", "finance", "hr", "engineer", "clientA"]) {
      await db.as(who);
      const r = await db.attempt("update settings set value = '1' where key = 'payment_two_approval_threshold'");
      assert.equal(r.rowCount, 0, `${who} must not change settings`);
    }
    await db.as("owner");
    const r = await db.attempt("update settings set value = '7500' where key = 'payment_two_approval_threshold'");
    assert.equal(r.rowCount, 1);
    assert.equal(Number(await db.one("select public.setting_num('payment_two_approval_threshold') v").then((x) => x.v)), 7500);
  }));

test("only the owner can give or remove roles", () =>
  inTx(async (db) => {
    const roleSql = "insert into user_roles (user_id, role_id, assigned_by) select $1, id, $2 from roles where code = 'finance'";
    for (const who of ["gm", "hr", "finance"]) {
      await db.as(who);
      const r = await db.attempt(roleSql, [U.engineer, U[who]]);
      assert.ok(r.error, `${who} must not assign roles`);
    }
    await db.as("owner");
    const ok = await db.attempt(roleSql, [U.engineer, U.owner]);
    assert.equal(ok.error, null, ok.error?.message);
    await db.as("gm");
    const perm = await db.attempt("update role_permissions set can_write = true where role_code = 'employee'");
    assert.equal(perm.rowCount, 0);
  }));

test("the last owner cannot be removed or deactivated", () =>
  inTx(async (db) => {
    await db.as("owner");
    const revoke = await db.attempt(
      "update user_roles set revoked_at = now() where user_id = $1 and role_id = (select id from roles where code = 'owner')", [U.owner]);
    assert.match(String(revoke.error?.message), /last owner/);
    const del = await db.attempt(
      "delete from user_roles where user_id = $1 and role_id = (select id from roles where code = 'owner')", [U.owner]);
    assert.match(String(del.error?.message), /last owner/);
    const off = await db.attempt("update profiles set is_active = false where id = $1", [U.owner]);
    assert.match(String(off.error?.message), /last owner/);

    // With a second owner, the first can step down.
    await db.q("insert into user_roles (user_id, role_id, assigned_by) select $1, id, $2 from roles where code = 'owner'", [U.gm, U.owner]);
    const ok = await db.attempt(
      "update user_roles set revoked_at = now() where user_id = $1 and role_id = (select id from roles where code = 'owner')", [U.owner]);
    assert.equal(ok.error, null, ok.error?.message);
  }));

test("staff can edit their own name but not activate / deactivate anyone", () =>
  inTx(async (db) => {
    await db.as("engineer");
    const name = await db.attempt("update profiles set full_name = 'New Name' where id = $1", [U.engineer]);
    assert.equal(name.rowCount, 1);
    const act = await db.attempt("update profiles set is_active = false where id = $1", [U.engineer]);
    assert.ok(act.error);
    const other = await db.attempt("update profiles set full_name = 'x' where id = $1", [U.finance]);
    assert.equal(other.rowCount, 0);
    await db.as("owner");
    const deact = await db.attempt("update profiles set is_active = false where id = $1", [U.engineer]);
    assert.equal(deact.rowCount, 1);
    await db.as("engineer");
    assert.equal(await db.count("projects"), 0, "a deactivated user loses access at once");
  }));

test("audit log records changes with the actor, and nobody can edit it", () =>
  inTx(async (db) => {
    await db.as("owner");
    await db.q("update settings set value = '6000' where key = 'payment_two_approval_threshold'");
    const row = await db.one(
      "select actor_id, action, old_values, new_values from audit_log where table_name = 'settings' order by id desc limit 1");
    assert.equal(row.actor_id, U.owner);
    assert.equal(row.action, "update");
    assert.equal(row.new_values.value, 6000);
    const del = await db.attempt("delete from audit_log");
    assert.ok(del.error || del.rowCount === 0);
    await db.as("hr");
    assert.equal(await db.count("audit_log"), 0);
  }));
