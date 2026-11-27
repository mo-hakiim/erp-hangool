import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera, FileText, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useCompany } from "@/features/settings/CompanySettings";
import { Alert, Badge, Button, EmptyState, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { InfoGrid, LiveBadge, Modal, ProgressBar, Section, Select, StatCard, StatusBadge, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { BarChartCard, brandColor } from "@/components/charts";
import { must, useLoad } from "./useQuery";

type Stage = {
  id: string; project_id: string; name: string; seq: number; planned_start: string | null; planned_end: string | null;
  actual_start: string | null; completed_at: string | null; budget_amount: number; milestone_amount: number; progress_pct: number; status: string;
};

type TabKey = "overview" | "stages" | "boq" | "drawings" | "reports" | "photos" | "documents" | "finance";

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const { t, locale } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<TabKey>("overview");

  const { data, error, loading, reload } = useLoad(async () => {
    const [project, summary, stages, members, boq, drawings, reports, docs, invoices, payments, approvals] = await Promise.all([
      supabase.from("projects").select("*, client:clients(id, name, phone, email), manager:profiles!projects_manager_id_fkey(full_name)").eq("id", id).maybeSingle(),
      supabase.from("project_summary").select("*").eq("project_id", id).maybeSingle(),
      supabase.from("stages").select("*").eq("project_id", id).order("seq"),
      supabase.from("project_members").select("id, user:profiles!project_members_user_id_fkey(full_name, email), role:roles(code)").eq("project_id", id),
      supabase.from("boq_items").select("id, stage_id, description, unit, quantity, unit_price, amount, boq_version, status").eq("project_id", id).order("boq_version", { ascending: false }),
      supabase.from("drawings").select("id, title, discipline, version_no, status, is_final, created_at").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("daily_reports").select("id, report_date, progress, problems, workers_present, photo_paths, visible_to_client, weather, author:profiles!daily_reports_author_id_fkey(full_name), stage:stages(name)").eq("project_id", id).order("report_date", { ascending: false }).limit(50),
      supabase.from("documents").select("id, title, category, current_version, updated_at").eq("project_id", id).order("updated_at", { ascending: false }),
      supabase.from("invoices").select("id, invoice_no, invoice_type, amount, amount_paid, due_date, status, stage_id").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("payments").select("id, amount, method, paid_at, status, payment_type").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("approvals").select("entity_id, status").eq("entity_table", "stages").eq("status", "pending"),
    ]);
    return {
      project: must(project), summary: must(summary), stages: (must(stages) as Stage[]).map((s) => ({ ...s, budget_amount: Number(s.budget_amount), milestone_amount: Number(s.milestone_amount) })),
      members: must(members) as unknown as Array<{ id: string; user: { full_name: string; email: string } | null; role: { code: string } | null }>,
      boq: must(boq), drawings: must(drawings), reports: must(reports) as unknown as Array<Record<string, unknown>>, docs: must(docs),
      invoices: must(invoices), payments: must(payments),
      pendingStageIds: new Set((must(approvals) as Array<{ entity_id: string }>).map((a) => a.entity_id)),
    };
  }, [id]);

  if (loading && !data) return <Spinner label={t.app.loading} />;
  if (error) return <Alert tone="error">{fmt(t.common.loadError, { msg: error })}</Alert>;
  if (!data?.project) {
    return (
      <EmptyState title={t.projects.notFound} action={<Link to="/owner/projects" className="text-sm font-medium text-primary hover:underline">{t.projects.backToList}</Link>} />
    );
  }

  const p = data.project as Record<string, unknown> & { client: { name: string; phone: string | null; email: string | null } | null; manager: { full_name: string } | null };
  const s = (data.summary ?? {}) as Record<string, number | boolean | string>;
  const photos = data.reports.flatMap((r) => (r.photo_paths as string[]) ?? []);
  const latestBoqVersion = data.boq.length ? Math.max(...data.boq.map((b) => b.boq_version as number)) : null;
  const daysToEnd = p.end_date ? Math.round((new Date(p.end_date as string).getTime() - Date.now()) / 86_400_000) : null;

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "overview", label: t.projects.tabOverview },
    { key: "stages", label: t.projects.tabStages, count: data.stages.length },
    { key: "boq", label: t.projects.tabBoq, count: data.boq.length },
    { key: "drawings", label: t.projects.tabDrawings, count: data.drawings.length },
    { key: "reports", label: t.projects.tabReports, count: data.reports.length },
    { key: "photos", label: t.projects.tabPhotos, count: photos.length },
    { key: "documents", label: t.projects.tabDocuments, count: data.docs.length },
    { key: "finance", label: t.projects.tabFinance },
  ];

  return (
    <div>
      <Link to="/owner/projects" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> {t.projects.backToList}
      </Link>
      <PageHeader
        title={p.name as string}
        subtitle={`${p.code} · ${p.client?.name ?? ""}${p.location ? ` · ${p.location}` : ""}`}
        actions={<><LiveBadge /><StatusBadge value={p.status as string} />{s.is_delayed && <StatusBadge value="overdue" />}</>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.common.progress} value={`${s.progress_pct ?? 0}%`} hint={<ProgressBar value={Number(s.progress_pct ?? 0)} />} />
        <StatCard label={t.projects.contractValue} value={money(Number(p.contract_value))} />
        <StatCard label={t.projects.collected} value={money(Number(s.collected ?? 0))} hint={`${t.projects.invoiced}: ${money(Number(s.invoiced ?? 0))}`} tone="green" />
        <StatCard label={t.projects.timeline} value={formatDate(p.end_date as string, locale)}
          hint={daysToEnd == null ? undefined : daysToEnd >= 0 ? fmt(t.projects.daysLeft, { n: daysToEnd }) : <span className="text-red-600">{fmt(t.projects.daysLate, { n: -daysToEnd })}</span>} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title={t.projects.tabOverview} className="lg:col-span-2">
            <InfoGrid items={[
              { label: t.common.client, value: <>{p.client?.name}<br /><span className="text-xs text-neutral-500">{[p.client?.phone, p.client?.email].filter(Boolean).join(" · ")}</span></> },
              { label: t.projects.manager, value: p.manager?.full_name ?? t.projects.noManager },
              { label: t.projects.startDate, value: formatDate(p.start_date as string, locale) },
              { label: t.projects.endDate, value: formatDate(p.end_date as string, locale) },
              { label: t.projects.budget, value: money(Number(p.budget)) },
              { label: t.projects.actualCost, value: money(Number(s.actual_cost ?? 0)) },
              { label: t.common.description, value: (p.description as string) || "—" },
            ]} />
          </Section>
          <Section title={t.projects.team} actions={<Users className="h-4 w-4 text-neutral-400" />}>
            {data.members.length === 0 && !p.manager ? <p className="text-sm text-neutral-500">—</p> : (
              <ul className="space-y-2.5 text-sm">
                {p.manager && <li className="flex justify-between gap-2"><span className="font-medium text-neutral-900">{p.manager.full_name}</span><Badge tone="amber">{t.roles.project_manager}</Badge></li>}
                {data.members.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="truncate text-neutral-800">{m.user?.full_name}</span>
                    <Badge>{m.role ? t.roles[m.role.code as keyof typeof t.roles] : ""}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t.projects.tabStages} className="lg:col-span-3">
            {data.stages.length === 0 ? <p className="text-sm text-neutral-500">{t.projects.noStages}</p> : (
              <BarChartCard height={220} x="name" data={data.stages.map((st) => ({ name: st.name, progress: st.progress_pct }))} series={[{ key: "progress", label: t.projects.progressPct, color: brandColor("gold") }]} />
            )}
          </Section>
        </div>
      )}

      {tab === "stages" && <StagesTab projectId={id} projectName={p.name as string} stages={data.stages} pending={data.pendingStageIds} invoices={data.invoices as Array<{ stage_id: string | null; amount: number }>} onChanged={reload} />}

      {tab === "boq" && (
        <Section title={latestBoqVersion ? fmt(t.projects.boqVersion, { v: latestBoqVersion }) : t.projects.tabBoq} live flush>
          <div className="p-4">
            <DataTable
              rows={data.boq as Array<Record<string, unknown>>}
              rowKey={(r) => r.id as string}
              exportName={`boq-${p.code}`}
              emptyTitle={t.projects.noBoq}
              columns={[
                { key: "description", label: t.projects.item, primary: true },
                { key: "stage", label: t.common.project, value: (r) => data.stages.find((st) => st.id === r.stage_id)?.name ?? "—" },
                { key: "quantity", label: t.projects.qty, kind: "number" },
                { key: "unit", label: t.common.unit },
                { key: "unit_price", label: t.projects.unitPrice, kind: "money" },
                { key: "amount", label: t.common.amount, kind: "money" },
                { key: "boq_version", label: t.documents.version, render: (r) => fmt(t.projects.version, { v: r.boq_version as number }) },
                { key: "status", label: t.common.status, kind: "status" },
              ]}
            />
          </div>
        </Section>
      )}

      {tab === "drawings" && (
        <DataTable rows={data.drawings as Array<Record<string, unknown>>} rowKey={(r) => r.id as string} emptyTitle={t.projects.noDrawings}
          columns={[
            { key: "title", label: t.common.name, primary: true },
            { key: "discipline", label: t.common.type },
            { key: "version_no", label: t.documents.version, render: (r) => <>{fmt(t.projects.version, { v: r.version_no as number })} {r.is_final ? <Badge tone="green">{t.projects.final}</Badge> : null}</> },
            { key: "status", label: t.common.status, kind: "status" },
            { key: "created_at", label: t.documents.updated, kind: "date" },
          ]} />
      )}

      {tab === "reports" && (
        data.reports.length === 0 ? <Section title={t.projects.tabReports}><EmptyState icon={<FileText className="h-10 w-10" />} title={t.projects.noReports} /></Section> : (
          <ul className="space-y-3">
            {data.reports.map((r) => (
              <li key={r.id as string}>
                <Section title={`${formatDate(r.report_date as string, locale)} · ${(r.stage as { name: string } | null)?.name ?? ""}`}
                  actions={<div className="flex items-center gap-2 text-xs text-neutral-500">{(r.author as { full_name: string } | null)?.full_name}{r.visible_to_client ? <Badge tone="blue">{t.projects.visibleToClient}</Badge> : null}</div>}>
                  <p className="text-sm text-neutral-800">{r.progress as string}</p>
                  {r.problems ? <p className="mt-2 text-sm text-red-700"><span className="font-medium">{t.projects.problems}:</span> {r.problems as string}</p> : null}
                  <p className="mt-2 text-xs text-neutral-500">{t.projects.workers}: {r.workers_present as number}{r.weather ? ` · ${r.weather}` : ""}</p>
                </Section>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "photos" && (
        <Section title={t.projects.tabPhotos}>
          {photos.length === 0 ? <EmptyState icon={<Camera className="h-10 w-10" />} title={t.projects.noPhotos} /> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((ph) => <li key={ph} className="aspect-square truncate rounded-lg bg-neutral-100 p-2 text-xs text-neutral-500">{ph}</li>)}</ul>
          )}
        </Section>
      )}

      {tab === "documents" && (
        <DataTable rows={data.docs as Array<Record<string, unknown>>} rowKey={(r) => r.id as string} emptyTitle={t.projects.noDocuments}
          columns={[
            { key: "title", label: t.common.name, primary: true },
            { key: "category", label: t.common.category },
            { key: "current_version", label: t.documents.version, render: (r) => fmt(t.projects.version, { v: r.current_version as number }) },
            { key: "updated_at", label: t.documents.updated, kind: "date" },
          ]} />
      )}

      {tab === "finance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t.projects.invoiced} value={money(Number(s.invoiced ?? 0))} />
            <StatCard label={t.projects.collected} value={money(Number(s.collected ?? 0))} tone="green" />
            <StatCard label={t.projects.outstanding} value={money(Number(s.invoiced ?? 0) - Number(s.collected ?? 0))} tone="amber" />
            <StatCard label={t.projects.actualCost} value={money(Number(s.actual_cost ?? 0))} hint={`${t.projects.budget}: ${money(Number(p.budget))}`} tone="red" />
          </div>
          <Section title={t.projects.invoices} live flush>
            <div className="p-4">
              <DataTable rows={data.invoices as Array<Record<string, unknown>>} rowKey={(r) => r.id as string} searchable={false}
                columns={[
                  { key: "invoice_no", label: t.finance.invoiceNo, primary: true },
                  { key: "invoice_type", label: t.finance.invoiceType, value: (r) => r.invoice_type as string },
                  { key: "amount", label: t.common.amount, kind: "money" },
                  { key: "amount_paid", label: t.finance.paid, kind: "money" },
                  { key: "due_date", label: t.finance.dueDate, kind: "date" },
                  { key: "status", label: t.common.status, kind: "status" },
                ]} />
            </div>
          </Section>
          <Section title={t.projects.payments} live flush>
            <div className="p-4">
              <DataTable rows={data.payments as Array<Record<string, unknown>>} rowKey={(r) => r.id as string} searchable={false}
                columns={[
                  { key: "paid_at", label: t.common.date, kind: "date", primary: true },
                  { key: "payment_type", label: t.common.type },
                  { key: "method", label: t.common.method },
                  { key: "amount", label: t.common.amount, kind: "money" },
                  { key: "status", label: t.common.status, kind: "status" },
                ]} />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- stages (REAL: add / edit / delete / request completion)

const EDITABLE_STATUSES = ["pending", "in_progress", "done"];

function StagesTab({ projectId, projectName, stages, pending, invoices, onChanged }: {
  projectId: string; projectName: string; stages: Stage[]; pending: Set<string>; invoices: Array<{ stage_id: string | null; amount: number }>; onChanged: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const { money } = useCompany();
  const [editing, setEditing] = useState<Stage | "new" | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function requestCompletion(st: Stage) {
    setMsg(null);
    const { error } = await supabase.rpc("request_approval", {
      p_type: "stage_completion", p_entity_table: "stages", p_entity_id: st.id,
      p_title: `${st.name} complete — ${projectName}`, p_link: `/owner/projects/${projectId}`,
    });
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: t.projects.completionRequested });
    await onChanged();
  }

  async function remove(st: Stage) {
    if (!window.confirm(t.projects.deleteStageConfirm)) return;
    const { error } = await supabase.from("stages").delete().eq("id", st.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    await onChanged();
  }

  const totalBudget = stages.reduce((s, x) => s + x.budget_amount, 0);
  const totalMilestones = stages.reduce((s, x) => s + x.milestone_amount, 0);

  return (
    <Section title={t.projects.tabStages} live flush actions={<Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> {t.projects.addStage}</Button>}>
      <div className="space-y-3 p-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {stages.length === 0 ? <EmptyState title={t.projects.noStages} /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">{t.projects.stageName}</th>
                  <th className="px-3 py-2 text-left">{t.projects.plannedStart}</th>
                  <th className="px-3 py-2 text-left">{t.projects.plannedEnd}</th>
                  <th className="px-3 py-2 text-right">{t.projects.stageBudget}</th>
                  <th className="px-3 py-2 text-right">{t.projects.milestone}</th>
                  <th className="px-3 py-2 text-left">{t.common.progress}</th>
                  <th className="px-3 py-2 text-left">{t.common.status}</th>
                  <th className="px-3 py-2 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stages.map((st) => {
                  const invoiced = invoices.filter((i) => i.stage_id === st.id).reduce((s, i) => s + Number(i.amount), 0);
                  return (
                    <tr key={st.id}>
                      <td className="px-3 py-2.5 text-neutral-500">{st.seq}</td>
                      <td className="px-3 py-2.5 font-medium capitalize text-neutral-900">{st.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDate(st.planned_start, locale)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDate(st.planned_end, locale)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{money(st.budget_amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {money(st.milestone_amount)}
                        {invoiced > 0 && <div className="text-[11px] text-neutral-500">{t.projects.invoiced}: {money(invoiced)}</div>}
                      </td>
                      <td className="min-w-[120px] px-3 py-2.5"><ProgressBar value={st.progress_pct} tone={st.status === "verified" ? "green" : "brand"} /></td>
                      <td className="px-3 py-2.5">
                        <StatusBadge value={st.status} />
                        {pending.has(st.id) && <div className="mt-1"><StatusBadge value="pending" /></div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {st.status === "done" && !pending.has(st.id) && (
                            <Button size="sm" variant="secondary" onClick={() => requestCompletion(st)} title={t.projects.requestCompletion}><Send className="h-4 w-4" /><span className="hidden xl:inline">{t.projects.requestCompletion}</span></Button>
                          )}
                          {st.status !== "verified" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(st)} aria-label={t.projects.editStage}><Pencil className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => remove(st)} aria-label={t.projects.deleteStage}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-neutral-50 text-sm font-medium">
                <tr>
                  <td className="px-3 py-2" colSpan={4}>{t.common.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(totalBudget)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(totalMilestones)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {stages.some((s) => s.status === "verified") && <p className="text-xs text-neutral-500">{t.projects.verifiedNote}</p>}
      </div>
      {editing && (
        <StageModal
          projectId={projectId}
          stage={editing === "new" ? null : editing}
          nextSeq={stages.length ? Math.max(...stages.map((s) => s.seq)) + 1 : 1}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); setMsg({ tone: "success", text: t.projects.stageSaved }); await onChanged(); }}
        />
      )}
    </Section>
  );
}

function StageModal({ projectId, stage, nextSeq, onClose, onSaved }: { projectId: string; stage: Stage | null; nextSeq: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({
    name: stage?.name ?? "", seq: String(stage?.seq ?? nextSeq), planned_start: stage?.planned_start ?? "", planned_end: stage?.planned_end ?? "",
    budget_amount: String(stage?.budget_amount ?? ""), milestone_amount: String(stage?.milestone_amount ?? ""),
    progress_pct: String(stage?.progress_pct ?? 0), status: stage?.status ?? "pending",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const row = {
      name: f.name.trim(), seq: Number(f.seq), planned_start: f.planned_start || null, planned_end: f.planned_end || null,
      budget_amount: Number(f.budget_amount || 0), milestone_amount: Number(f.milestone_amount || 0),
      progress_pct: Math.max(0, Math.min(100, Number(f.progress_pct || 0))), status: f.status,
    };
    const { error } = stage
      ? await supabase.from("stages").update(row).eq("id", stage.id)
      : await supabase.from("stages").insert({ ...row, project_id: projectId });
    setBusy(false);
    if (error) return setError(error.message.includes("stages_project_id_seq_key") ? `${t.projects.seq}: ${f.seq} — already used` : error.message);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={stage ? t.projects.editStage : t.projects.addStage}
      footer={<><Button variant="secondary" onClick={onClose}>{t.app.cancel}</Button><Button type="submit" form="stage-form" loading={busy}>{busy ? t.app.saving : t.app.save}</Button></>}>
      <form id="stage-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
        <Field label={t.projects.stageName} htmlFor="s-name"><Input id="s-name" required list="stage-names" value={f.name} onChange={set("name")} /></Field>
        <datalist id="stage-names">{["foundation", "columns", "walls", "roof", "finishing"].map((n) => <option key={n} value={n} />)}</datalist>
        <Field label={t.projects.seq} htmlFor="s-seq"><Input id="s-seq" type="number" min="1" required value={f.seq} onChange={set("seq")} /></Field>
        <Field label={t.projects.plannedStart} htmlFor="s-start"><Input id="s-start" type="date" value={f.planned_start} onChange={set("planned_start")} /></Field>
        <Field label={t.projects.plannedEnd} htmlFor="s-end"><Input id="s-end" type="date" min={f.planned_start || undefined} value={f.planned_end} onChange={set("planned_end")} /></Field>
        <Field label={t.projects.stageBudget} htmlFor="s-budget"><Input id="s-budget" type="number" min="0" step="0.01" value={f.budget_amount} onChange={set("budget_amount")} /></Field>
        <Field label={t.projects.milestone} htmlFor="s-ms"><Input id="s-ms" type="number" min="0" step="0.01" value={f.milestone_amount} onChange={set("milestone_amount")} /></Field>
        <Field label={t.projects.progressPct} htmlFor="s-prog"><Input id="s-prog" type="number" min="0" max="100" value={f.progress_pct} onChange={set("progress_pct")} /></Field>
        <Field label={t.common.status} htmlFor="s-status">
          <Select id="s-status" value={f.status} onChange={set("status")}>
            {EDITABLE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
