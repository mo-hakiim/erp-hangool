import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, useI18n } from "@/i18n";
import { cn } from "@/lib/format";
import { exportCsv } from "@/lib/export";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from "@/components/ui";
import { LiveBadge, Select } from "@/components/blocks";
import { must, useLoad } from "./useQuery";

type Entry = { id: number; actor_id: string | null; action: string; table_name: string; record_id: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };
const PAGE = 50;
const ACTIONS = ["create", "update", "delete", "approve", "reject", "role_change"] as const;
const tone: Record<string, "green" | "blue" | "red" | "amber" | "purple" | "slate"> = { create: "green", update: "blue", delete: "red", approve: "green", reject: "red", role_change: "purple" };
const HIDDEN = new Set(["updated_at", "created_at"]);

function changes(e: Entry) {
  const o = e.old_values ?? {}, n = e.new_values ?? {};
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => !HIDDEN.has(k));
  return keys.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => ({ field: k, before: o[k], after: n[k] }));
}
const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function AuditPage() {
  const { t, locale } = useI18n();
  const [f, setF] = useState({ table: "", action: "", actor: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const meta = useLoad(async () => {
    const [profiles, tables] = await Promise.all([
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("audit_log").select("table_name").order("table_name").limit(5000),
    ]);
    return { people: must(profiles), tables: [...new Set(must(tables).map((r) => r.table_name as string))] };
  });
  const names = new Map((meta.data?.people ?? []).map((p) => [p.id, p.full_name]));

  const { data, error, loading } = useLoad(async () => {
    let q = supabase.from("audit_log").select("*", { count: "exact" }).order("id", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (f.table) q = q.eq("table_name", f.table);
    if (f.action) q = q.eq("action", f.action);
    if (f.actor === "system") q = q.is("actor_id", null); else if (f.actor) q = q.eq("actor_id", f.actor);
    if (f.from) q = q.gte("created_at", new Date(f.from).toISOString());
    if (f.to) q = q.lt("created_at", new Date(new Date(f.to).getTime() + 86_400_000).toISOString());
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return { rows: (res.data ?? []) as Entry[], count: res.count ?? 0 };
  }, [f, page]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(0); };
  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const actorName = (id: string | null) => (id ? names.get(id) ?? id.slice(0, 8) : t.audit.system);

  const doExport = () => exportCsv("audit-log", [t.audit.when, t.audit.actor, t.audit.action, t.audit.table, t.audit.record, t.audit.changes],
    rows.map((e) => [e.created_at, actorName(e.actor_id), e.action, e.table_name, e.record_id, changes(e).map((c) => `${c.field}: ${show(c.before)} → ${show(c.after)}`).join("; ")]));

  return (
    <div>
      <PageHeader title={t.audit.title} subtitle={t.audit.subtitle} actions={<><LiveBadge /><Button size="sm" variant="secondary" onClick={doExport}><Download className="h-4 w-4" /> {t.common.exportExcel}</Button></>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={f.table} onChange={set("table")} aria-label={t.audit.table}>
          <option value="">{t.audit.anyTable}</option>
          {meta.data?.tables.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
        <Select value={f.action} onChange={set("action")} aria-label={t.audit.action}>
          <option value="">{t.audit.anyAction}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{t.audit.actions[a]}</option>)}
        </Select>
        <Select value={f.actor} onChange={set("actor")} aria-label={t.audit.actor}>
          <option value="">{t.audit.anyone}</option>
          <option value="system">{t.audit.system}</option>
          {meta.data?.people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
        <Input type="date" value={f.from} onChange={set("from")} aria-label={t.common.from} />
        <Input type="date" value={f.to} onChange={set("to")} aria-label={t.common.to} />
      </Card>
      {error && <div className="mb-4"><Alert tone="error">{fmt(t.common.loadError, { msg: error })}</Alert></div>}
      <Card>
        {loading && !data ? <Spinner /> : rows.length === 0 ? <EmptyState title={t.common.noResults} body={t.common.noResultsBody} /> : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((e) => {
              const ch = changes(e);
              const isOpen = open === e.id;
              return (
                <Fragment key={e.id}>
                  <li>
                    <button onClick={() => setOpen(isOpen ? null : e.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50" aria-expanded={isOpen}>
                      {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />}
                      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[170px_160px_110px_1fr] sm:items-center sm:gap-3">
                        <span className="text-xs tabular-nums text-neutral-500">{new Date(e.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</span>
                        <span className="truncate text-sm font-medium text-neutral-900">{actorName(e.actor_id)}</span>
                        <span><Badge tone={tone[e.action] ?? "slate"}>{t.audit.actions[e.action as keyof typeof t.audit.actions] ?? e.action}</Badge></span>
                        <span className="truncate text-sm text-neutral-600"><span className="font-mono text-xs text-neutral-800">{e.table_name}</span>{ch.length ? ` · ${ch.slice(0, 3).map((c) => c.field).join(", ")}${ch.length > 3 ? "…" : ""}` : ""}</span>
                      </div>
                    </button>
                  </li>
                  {isOpen && (
                    <li className="bg-neutral-50 px-4 py-3">
                      <p className="mb-2 text-xs text-neutral-500">{t.audit.record}: <span className="font-mono">{e.record_id}</span></p>
                      {ch.length === 0 ? <p className="text-sm text-neutral-500">{t.audit.noChanges}</p> : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-1 pr-4">{t.audit.field}</th><th className="py-1 pr-4">{t.audit.before}</th><th className="py-1">{t.audit.after}</th></tr></thead>
                            <tbody>
                              {ch.map((c) => (
                                <tr key={c.field} className="align-top">
                                  <td className="py-1 pr-4 font-mono text-xs text-neutral-700">{c.field}</td>
                                  <td className={cn("max-w-xs break-all py-1 pr-4 text-red-700", e.action === "create" && "text-neutral-400")}>{show(c.before)}</td>
                                  <td className="max-w-xs break-all py-1 text-emerald-700">{show(c.after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        )}
      </Card>
      {total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-neutral-600">
          <span>{fmt(t.common.rowsShown, { from: page * PAGE + 1, to: Math.min(total, (page + 1) * PAGE), total })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>{t.common.prev}</Button>
            <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>{t.common.next}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
