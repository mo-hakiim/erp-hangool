// Supabase Edge Function: admin-staff
// Owner-only staff administration that needs the Auth admin API:
//   { action: "invite", email, full_name, roles: string[], client_id?, redirect_to }
//   { action: "set_active", user_id, active: boolean }
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions by
// Supabase automatically. The service_role key never leaves this server-side function.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const ROLES = new Set([
  "owner", "general_manager", "finance", "accountant", "hr", "procurement", "storekeeper", "project_manager",
  "site_engineer", "site_supervisor", "qs", "architect", "marketing", "real_estate_officer", "employee", "client",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // The caller's own client: every database write goes through RLS as the owner (and is audited as them).
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: isOwner, error: ownerErr } = await asCaller.rpc("is_owner");
  if (ownerErr || isOwner !== true) return json({ error: "Only the owner can manage staff." }, 403);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    if (body.action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const roles = Array.isArray(body.roles) ? body.roles.map(String).filter((r) => ROLES.has(r)) : [];
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
      if (!fullName) return json({ error: "Enter the person's name." }, 400);
      if (roles.length === 0) return json({ error: "Choose at least one role." }, 400);

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: typeof body.redirect_to === "string" ? body.redirect_to : undefined,
      });
      if (error || !data.user) return json({ error: error?.message ?? "Invite failed" }, 400);
      const userId = data.user.id;

      await asCaller.from("profiles").update({ full_name: fullName }).eq("id", userId);
      for (const role of roles) {
        const { error: roleErr } = await asCaller.rpc("admin_set_role", { p_user: userId, p_role: role, p_on: true });
        if (roleErr) return json({ error: roleErr.message, user_id: userId }, 400);
      }
      if (typeof body.client_id === "string" && body.client_id) {
        const { error: cErr } = await asCaller.from("clients").update({ user_id: userId }).eq("id", body.client_id);
        if (cErr) return json({ error: cErr.message, user_id: userId }, 400);
      }
      return json({ ok: true, user_id: userId });
    }

    if (body.action === "set_active") {
      const userId = String(body.user_id ?? "");
      const active = body.active === true;
      // Profile first: the database refuses to deactivate the last owner.
      const { error } = await asCaller.from("profiles").update({ is_active: active }).eq("id", userId);
      if (error) return json({ error: error.message }, 400);
      const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
      if (banErr) return json({ error: banErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
