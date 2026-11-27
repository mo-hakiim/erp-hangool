// Creates (or updates) the @hangooldevelopment.com demo staff accounts: email already confirmed,
// no invite / confirmation emails. The password comes from DEMO_STAFF_PASSWORD in .env.local
// (never commit it). Safe to re-run: existing accounts get their name, password and role refreshed.
//
//   node scripts/create-demo-staff.mjs
import { connect, loadEnv } from "./db.mjs";

export const DEMO_STAFF = [
  { email: "owner@hangooldevelopment.com", name: "Hangool CEO", role: "owner" },
  { email: "manager@hangooldevelopment.com", name: "Hangool General Manager", role: "general_manager" },
  { email: "engineering@hangooldevelopment.com", name: "Hangool Site Engineer", role: "site_engineer" },
  { email: "boq@hangooldevelopment.com", name: "Hangool Quantity Surveyor", role: "qs" },
  { email: "architect@hangooldevelopment.com", name: "Hangool Architect", role: "architect" },
  { email: "marketing@hangooldevelopment.com", name: "Hangool Sales & Marketing", role: "marketing" },
  { email: "finance@hangooldevelopment.com", name: "Hangool Finance", role: "finance" },
];

loadEnv();
const password = process.env.DEMO_STAFF_PASSWORD;
if (!password || password.length < 12) {
  console.error("Set DEMO_STAFF_PASSWORD (12+ characters) in .env.local first.");
  process.exit(1);
}

const c = await connect();
try {
  await c.query("begin");
  for (const s of DEMO_STAFF) {
    const existing = await c.query("select id from auth.users where lower(email) = lower($1)", [s.email]);
    let id = existing.rows[0]?.id;
    if (!id) {
      const ins = await c.query(
        `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
           confirmation_token, recovery_token, email_change_token_new, email_change,
           email_change_token_current, phone_change, phone_change_token, reauthentication_token)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
           crypt($2, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
           jsonb_build_object('full_name', $3::text), now(), now(), '', '', '', '', '', '', '', '')
         returning id`, [s.email, password, s.name]);
      id = ins.rows[0].id;
      await c.query(
        `insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
         values (gen_random_uuid(), $1::uuid, $3::text, 'email', jsonb_build_object('sub', $3::text, 'email', $2::text, 'email_verified', true), now(), now(), now())`,
        [id, s.email, String(id)]);
    } else {
      await c.query(
        "update auth.users set encrypted_password = crypt($2, gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), banned_until = null, updated_at = now() where id = $1",
        [id, password]);
    }
    await c.query("update public.profiles set full_name = $2, is_active = true where id = $1", [id, s.name]);
    await c.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code = $2
         and not exists (select 1 from public.user_roles x where x.user_id = $1 and x.role_id = r.id and x.revoked_at is null)`,
      [id, s.role]);
    console.log(`${existing.rows[0] ? "updated" : "created"}  ${s.email}  →  ${s.role}`);
  }
  await c.query("commit");
} catch (e) {
  await c.query("rollback");
  throw e;
} finally {
  await c.end();
}
