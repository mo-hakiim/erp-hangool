import { useState, type FormEvent } from "react";
import { Power, ShieldCheck, ShieldOff, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type RoleCode } from "@/auth/AuthProvider";
import { fmt, useI18n } from "@/i18n";
import { timeAgo } from "@/lib/format";
import { Alert, Badge, Button, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { LiveBadge, Modal, Select, StatCard, StatusBadge } from "@/components/blocks";
import { DataTable, type Column } from "@/components/DataTable";
import { must, useLoad } from "./useQuery";

export const ALL_ROLES: RoleCode[] = [
  "owner", "general_manager", "finance", "accountant", "hr", "procurement", "storekeeper", "project_manager",
  "site_engineer", "site_supervisor", "qs", "architect", "marketing", "real_estate_officer", "employee", "client",
];

type Person = {
  id: string; full_name: string; email: string; phone: string | null; is_active: boolean; created_at: string;
  last_sign_in_at: string | null; invited_at: string | null; roles: RoleCode[]; has_2fa: boolean; client_id: string | null; client_name: string | null;
};

/** Calls the admin-staff Edge Function (service_role stays on the server). */
async function callAdmin(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; user_id?: string }> {
  const { data, error } = await supabase.functions.invoke("admin-staff", { body });
  if (error) {
    // FunctionsHttpError carries the JSON body in error.context
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try { const j = await ctx.json(); if (j?.error) return { error: j.error }; } catch { /* not JSON */ }
    }
    return { error: error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError" ? "__missing__" : error.message };
  }
  return data as { ok?: boolean; error?: string };
}

export function StaffPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const { data, error, loading, reload } = useLoad(async () => must(await supabase.rpc("admin_staff_list")) as Person[]);
  const people = data ?? [];

  const friendly = (m: string) => (m === "__missing__" ? t.staff.functionMissing : /last owner/i.test(m) ? t.staff.lastOwner : m);

  async function toggleActive(p: Person) {
    if (p.is_active && !window.confirm(fmt(t.staff.deactivateConfirm, { name: p.full_name }))) return;
    setMsg(null);
    const res = await callAdmin({ action: "set_active", user_id: p.id, active: !p.is_active });
    if (res.error) return setMsg({ tone: res.error === "__missing__" ? "warning" : "error", text: friendly(res.error) });
    await reload();
  }

  const columns: Column<Person>[] = [
    { key: "full_name", label: t.common.name, primary: true, render: (p) => (
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{p.full_name}{p.id === auth.session?.user.id && <span className="ml-1 text-xs font-normal text-slate-500">({t.staff.you})</span>}</p>
        <p className="truncate text-xs text-slate-500">{p.email}</p>
        {p.client_name && <p className="text-xs text-slate-500">{fmt(t.staff.clientLinked, { name: p.client_name })}</p>}
      </div>
    ), value: (p) => `${p.full_name} ${p.email}` },
    { key: "roles", label: t.staff.roles, render: (p) => (
      <div className="flex flex-wrap gap-1">{p.roles.length ? p.roles.map((r) => <Badge key={r} tone={r === "owner" ? "amber" : r === "client" ? "blue" : "slate"}>{t.roles[r]}</Badge>) : "—"}</div>
    ), value: (p) => p.roles.map((r) => t.roles[r]).join(", ") },
    { key: "status", label: t.common.status, render: (p) => <StatusBadge value={!p.is_active ? "inactive" : !p.last_sign_in_at && p.invited_at ? "invited" : "active"} />,
      value: (p) => (!p.is_active ? "inactive" : "active") },
    { key: "has_2fa", label: t.staff.twoFa, render: (p) => p.has_2fa ? <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="2FA on" /> : <ShieldOff className="h-4 w-4 text-slate-300" aria-label="2FA off" />, value: (p) => (p.has_2fa ? "on" : "off") },
    { key: "last_sign_in_at", label: t.staff.lastSignIn, render: (p) => (p.last_sign_in_at ? timeAgo(p.last_sign_in_at, t) : t.staff.never), hideOnMobile: true },
    { key: "actions", label: t.common.actions, render: (p) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>{t.staff.editRoles}</Button>
        {p.id !== auth.session?.user.id && (
          <Button size="sm" variant={p.is_active ? "ghost" : "secondary"} onClick={() => toggleActive(p)} title={p.is_active ? t.staff.deactivate : t.staff.reactivate}>
            <Power className={p.is_active ? "h-4 w-4 text-red-600" : "h-4 w-4 text-emerald-600"} />
            <span className="hidden xl:inline">{p.is_active ? t.staff.deactivate : t.staff.reactivate}</span>
          </Button>
        )}
      </div>
    ), value: () => "" },
  ];

  return (
    <div>
      <PageHeader title={t.staff.title} subtitle={t.staff.subtitle}
        actions={<><LiveBadge /><Button onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" /> {t.staff.invite}</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.staff.active} value={people.filter((p) => p.is_active && !p.roles.every((r) => r === "client")).length} icon={<Users className="h-4 w-4" />} tone="green" />
        <StatCard label={t.roles.client} value={people.filter((p) => p.roles.includes("client")).length} tone="blue" />
        <StatCard label={t.staff.twoFa} value={`${people.filter((p) => p.has_2fa).length} / ${people.filter((p) => p.roles.some((r) => r !== "client")).length}`} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label={t.status.inactive} value={people.filter((p) => !p.is_active).length} tone="red" />
      </div>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {error && <div className="mb-4"><Alert tone="error">{fmt(t.common.loadError, { msg: error })}</Alert></div>}
      {loading && !data ? <Spinner /> : (
        <DataTable rows={people} columns={columns} rowKey={(p) => p.id} pageSize={15} exportName="staff"
          filters={[
            { key: "role", label: t.staff.filterRole, options: ALL_ROLES.map((r) => ({ value: r, label: t.roles[r] })), match: (p, v) => p.roles.includes(v as RoleCode) },
            { key: "active", label: t.common.status, options: [{ value: "active", label: t.status.active }, { value: "inactive", label: t.status.inactive }], match: (p, v) => (v === "active") === p.is_active },
          ]} />
      )}
      {inviting && <InviteModal onClose={() => setInviting(false)} onDone={async (email) => { setInviting(false); setMsg({ tone: "success", text: fmt(t.staff.inviteSent, { email }) }); await reload(); }} friendly={friendly} />}
      {editing && <RolesModal person={editing} onClose={() => setEditing(null)} onDone={async () => { setEditing(null); setMsg({ tone: "success", text: t.staff.rolesSaved }); await reload(); }} friendly={friendly} />}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: RoleCode[]; onChange: (v: RoleCode[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ALL_ROLES.map((r) => (
        <label key={r} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={value.includes(r)}
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
          {t.roles[r]}
        </label>
      ))}
    </div>
  );
}

function RolesModal({ person, onClose, onDone, friendly }: { person: Person; onClose: () => void; onDone: () => void; friendly: (m: string) => string }) {
  const { t } = useI18n();
  const [roles, setRoles] = useState<RoleCode[]>(person.roles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const add = roles.filter((r) => !person.roles.includes(r));
    const remove = person.roles.filter((r) => !roles.includes(r));
    // Add first, so moving "owner" to someone else never leaves zero owners in between.
    for (const r of [...add.map((x) => [x, true] as const), ...remove.map((x) => [x, false] as const)]) {
      const { error } = await supabase.rpc("admin_set_role", { p_user: person.id, p_role: r[0], p_on: r[1] });
      if (error) { setBusy(false); return setError(friendly(error.message)); }
    }
    setBusy(false);
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={fmt(t.staff.editRolesTitle, { name: person.full_name })} wide
      footer={<><Button variant="secondary" onClick={onClose}>{t.app.cancel}</Button><Button onClick={save} loading={busy}>{t.staff.saveRoles}</Button></>}>
      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
      <RolePicker value={roles} onChange={setRoles} />
    </Modal>
  );
}

function InviteModal({ onClose, onDone, friendly }: { onClose: () => void; onDone: (email: string) => void; friendly: (m: string) => string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<RoleCode[]>([]);
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clients = useLoad(async () => must(await supabase.from("clients").select("id, name, user_id").is("user_id", null).order("name")));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (roles.length === 0) return setError(t.staff.pickRole);
    setBusy(true);
    setError(null);
    const res = await callAdmin({
      action: "invite", email: email.trim(), full_name: name.trim(), roles,
      client_id: roles.includes("client") ? clientId || null : null,
      redirect_to: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (res.error) return setError(friendly(res.error));
    onDone(email.trim());
  }

  return (
    <Modal open onClose={onClose} title={t.staff.inviteTitle} wide
      footer={<><Button variant="secondary" onClick={onClose}>{t.app.cancel}</Button><Button type="submit" form="invite-form" loading={busy}>{t.staff.sendInvite}</Button></>}>
      <form id="invite-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">{t.staff.inviteHint}</p>
        {error && <Alert tone={error === t.staff.functionMissing ? "warning" : "error"}>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.staff.fullName} htmlFor="inv-name"><Input id="inv-name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t.common.email} htmlFor="inv-email"><Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t.staff.roles}</p>
          <RolePicker value={roles} onChange={setRoles} />
        </div>
        {roles.includes("client") && (
          <Field label={t.staff.linkClient} htmlFor="inv-client">
            <Select id="inv-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">{t.staff.linkClientNone}</option>
              {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
