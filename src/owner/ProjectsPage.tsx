import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, HardHat, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, useI18n } from "@/i18n";
import { useCompany } from "@/features/settings/CompanySettings";
import { Alert, Button, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { LiveBadge, Modal, Select, StatCard, StatusBadge, statusLabel } from "@/components/blocks";
import { DataTable, type Column } from "@/components/DataTable";
import { must, useLoad } from "./useQuery";

export type ProjectRow = {
  project_id: string; code: string; name: string; status: string; client_id: string; manager_id: string | null;
  start_date: string | null; end_date: string | null; contract_value: number; budget: number; stage_count: number;
  progress_pct: number; stage_budget: number; invoiced: number; collected: number; actual_cost: number; is_delayed: boolean;
  client_name: string; manager_name: string; location: string | null;
};

const PROJECT_STATUSES = ["design", "boq", "active", "on_hold", "handed_over", "cancelled"];

export async function loadManagers() {
  const rows = must(await supabase.from("user_roles")
    .select("user_id, role:roles!inner(code), profile:profiles!user_roles_user_id_fkey(full_name, is_active)")
    .eq("roles.code", "project_manager").is("revoked_at", null));
  const list = (rows as unknown as Array<{ user_id: string; profile: { full_name: string; is_active: boolean } | null }>)
    .filter((r) => r.profile?.is_active)
    .map((r) => ({ id: r.user_id, name: r.profile!.full_name }));
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function ProjectsPage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const [summary, projects, clients, profiles] = await Promise.all([
      supabase.from("project_summary").select("*").order("code", { ascending: false }),
      supabase.from("projects").select("id, location"),
      supabase.from("clients").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const cl = new Map(must(clients).map((c) => [c.id, c.name]));
    const pr = new Map(must(profiles).map((p) => [p.id, p.full_name]));
    const loc = new Map(must(projects).map((p) => [p.id, p.location]));
    return (must(summary) as ProjectRow[]).map((r) => ({
      ...r, contract_value: Number(r.contract_value), budget: Number(r.budget), invoiced: Number(r.invoiced),
      collected: Number(r.collected), actual_cost: Number(r.actual_cost), stage_budget: Number(r.stage_budget),
      client_name: cl.get(r.client_id) ?? "—", manager_name: r.manager_id ? pr.get(r.manager_id) ?? "—" : "—",
      location: loc.get(r.project_id) ?? null,
    }));
  });

  const rows = data ?? [];
  const stats = useMemo(() => ({
    active: rows.filter((r) => r.status === "active").length,
    delayed: rows.filter((r) => r.is_delayed).length,
    done: rows.filter((r) => r.status === "handed_over").length,
    value: rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + r.contract_value, 0),
  }), [rows]);

  const columns: Column<ProjectRow>[] = [
    { key: "name", label: t.projects.name, primary: true, render: (r) => (
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{r.name}</p>
        <p className="text-xs text-slate-500">{r.code}{r.location ? ` · ${r.location}` : ""}</p>
      </div>
    ), value: (r) => `${r.name} ${r.code} ${r.location ?? ""}` },
    { key: "client_name", label: t.common.client },
    { key: "manager_name", label: t.projects.manager, hideOnMobile: true },
    { key: "status", label: t.common.status, render: (r) => (
      <div className="flex flex-wrap items-center gap-1"><StatusBadge value={r.status} />{r.is_delayed && <StatusBadge value="overdue" />}</div>
    ), value: (r) => statusLabel(t, r.status) },
    { key: "progress_pct", label: t.common.progress, kind: "progress" },
    { key: "contract_value", label: t.projects.contractValue, kind: "money" },
    { key: "end_date", label: t.projects.endDate, kind: "date", hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader
        title={t.projects.title}
        subtitle={t.projects.subtitle}
        actions={<><LiveBadge /><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.projects.new}</Button></>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.overview.activeProjects} value={stats.active} icon={<HardHat className="h-4 w-4" />} tone="blue" />
        <StatCard label={t.overview.delayedProjects} value={stats.delayed} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label={t.overview.completedProjects} value={stats.done} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <StatCard label={t.projects.contractValue} value={money(stats.value, { compact: true })} tone="amber" />
      </div>
      {error && <div className="mb-4"><Alert tone="error">{fmt(t.common.loadError, { msg: error })}</Alert></div>}
      {loading && !data ? <Spinner /> : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.project_id}
          onRowClick={(r) => navigate(`/owner/projects/${r.project_id}`)}
          searchPlaceholder={t.projects.searchPlaceholder}
          filters={[
            { key: "status", label: t.common.status, options: PROJECT_STATUSES.map((s) => ({ value: s, label: statusLabel(t, s) })) },
            { key: "delayed", label: t.projects.delayed, options: [{ value: "yes", label: t.projects.onlyDelayed }], match: (r, v) => v !== "yes" || r.is_delayed },
          ]}
          exportName="projects"
          emptyTitle={t.common.noResults}
        />
      )}
      <CreateProjectModal open={creating} onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); await reload(); navigate(`/owner/projects/${id}`); }} />
    </div>
  );
}

function CreateProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const { settings } = useCompany();
  const [form, setForm] = useState({ name: "", client_id: "", manager_id: "", location: "", start_date: "", end_date: "", contract_value: "", budget: "", status: "design" });
  const [defaultStages, setDefaultStages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lists = useLoad(async () => {
    if (!open) return { clients: [], managers: [] };
    const [clients, managers] = await Promise.all([supabase.from("clients").select("id, name").order("name"), loadManagers()]);
    return { clients: must(clients), managers };
  }, [open]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.from("projects").insert({
      name: form.name.trim(), client_id: form.client_id, manager_id: form.manager_id || null, location: form.location.trim() || null,
      start_date: form.start_date || null, end_date: form.end_date || null, status: form.status,
      contract_value: Number(form.contract_value || 0), budget: Number(form.budget || 0),
    }).select("id, code").single();
    if (error || !data) { setBusy(false); return setError(error?.message ?? t.app.errorTitle); }
    if (defaultStages) {
      const { error: sErr } = await supabase.rpc("create_default_stages", { p_project: data.id });
      if (sErr) { setBusy(false); return setError(sErr.message); }
    }
    setBusy(false);
    setForm({ name: "", client_id: "", manager_id: "", location: "", start_date: "", end_date: "", contract_value: "", budget: "", status: "design" });
    onCreated(data.id);
  }

  return (
    <Modal open={open} onClose={onClose} title={t.projects.createTitle} wide
      footer={<><Button variant="secondary" onClick={onClose}>{t.app.cancel}</Button><Button type="submit" form="create-project" loading={busy}>{busy ? t.common.creating : t.common.create}</Button></>}>
      <form id="create-project" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
        {lists.data && lists.data.clients.length === 0 && <div className="sm:col-span-2"><Alert tone="warning">{t.projects.noClients}</Alert></div>}
        <div className="sm:col-span-2">
          <Field label={t.projects.name} htmlFor="p-name"><Input id="p-name" required value={form.name} onChange={set("name")} /></Field>
        </div>
        <Field label={t.common.client} htmlFor="p-client">
          <Select id="p-client" required value={form.client_id} onChange={set("client_id")}>
            <option value="">{t.projects.chooseClient}</option>
            {lists.data?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label={t.projects.manager} htmlFor="p-manager">
          <Select id="p-manager" value={form.manager_id} onChange={set("manager_id")}>
            <option value="">{t.projects.noManager}</option>
            {lists.data?.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label={t.common.location} htmlFor="p-loc"><Input id="p-loc" value={form.location} onChange={set("location")} /></Field>
        <Field label={t.common.status} htmlFor="p-status">
          <Select id="p-status" value={form.status} onChange={set("status")}>
            {PROJECT_STATUSES.filter((s) => s !== "cancelled").map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
          </Select>
        </Field>
        <Field label={t.projects.startDate} htmlFor="p-start"><Input id="p-start" type="date" value={form.start_date} onChange={set("start_date")} /></Field>
        <Field label={t.projects.endDate} htmlFor="p-end"><Input id="p-end" type="date" min={form.start_date || undefined} value={form.end_date} onChange={set("end_date")} /></Field>
        <Field label={t.projects.contractValue} htmlFor="p-value"><Input id="p-value" type="number" min="0" step="0.01" inputMode="decimal" value={form.contract_value} onChange={set("contract_value")} /></Field>
        <Field label={t.projects.budget} htmlFor="p-budget"><Input id="p-budget" type="number" min="0" step="0.01" inputMode="decimal" value={form.budget} onChange={set("budget")} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={defaultStages} onChange={(e) => setDefaultStages(e.target.checked)} />
          {fmt(t.projects.defaultStages, { names: settings.stageNames.join(", ") })}
        </label>
      </form>
    </Modal>
  );
}

