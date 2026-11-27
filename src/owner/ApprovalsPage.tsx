import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, CheckCircle2, Circle, CircleSlash, Clock, Inbox, X, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type RoleCode } from "@/auth/AuthProvider";
import { fmt, useI18n } from "@/i18n";
import { cn, timeAgo } from "@/lib/format";
import { useCompany } from "@/features/settings/CompanySettings";
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Spinner } from "@/components/ui";
import { LiveBadge, Modal, Select, StatusBadge, Tabs, Textarea } from "@/components/blocks";
import { must, useLoad } from "./useQuery";

type Step = {
  id: string; request_group: string; approval_type: string; entity_table: string; entity_id: string; title: string; link: string | null;
  step_order: number; status: string; amount: number | null; comment: string | null; decided_at: string | null; created_at: string;
  requested_by: string; role: { code: RoleCode } | null;
  requester: { full_name: string } | null; approver: { full_name: string } | null;
};
type Request = {
  group: string; type: string; title: string; link: string | null; amount: number | null; requestedBy: string; requesterName: string;
  createdAt: string; lastDecided: string | null; overall: "pending" | "approved" | "rejected" | "cancelled"; steps: Step[]; current: Step | null;
};

const TYPES = ["all", "purchase", "payment", "expense", "change_request", "design", "boq", "stage_completion", "leave", "material_request"] as const;

function groupSteps(rows: Step[]): Request[] {
  const map = new Map<string, Step[]>();
  for (const r of rows) map.set(r.request_group, [...(map.get(r.request_group) ?? []), r]);
  return [...map.values()].map((steps) => {
    steps.sort((a, b) => a.step_order - b.step_order);
    const first = steps[0]!;
    const rejected = steps.some((s) => s.status === "rejected");
    const pending = steps.some((s) => s.status === "pending");
    const overall: Request["overall"] = rejected ? "rejected" : pending ? "pending" : steps.every((s) => ["approved", "skipped"].includes(s.status)) ? "approved" : "cancelled";
    const decided = steps.map((s) => s.decided_at).filter(Boolean).sort() as string[];
    return {
      group: first.request_group, type: first.approval_type, title: first.title, link: first.link, amount: first.amount,
      requestedBy: first.requested_by, requesterName: first.requester?.full_name ?? "—", createdAt: first.created_at,
      lastDecided: decided.at(-1) ?? null, overall, steps, current: overall === "pending" ? steps.find((s) => s.status === "pending") ?? null : null,
    };
  }).sort((a, b) => (b.lastDecided ?? b.createdAt).localeCompare(a.lastDecided ?? a.createdAt));
}

export function ApprovalsPage() {
  const { t } = useI18n();
  const { money, settings } = useCompany();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"pending" | "history">("pending");
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [selected, setSelected] = useState<string | null>(params.get("id"));

  const { data, error, loading, reload } = useLoad(async () => {
    const rows = must(await supabase.from("approvals")
      .select("id, request_group, approval_type, entity_table, entity_id, title, link, step_order, status, amount, comment, decided_at, created_at, requested_by, role:roles(code), requester:profiles!approvals_requested_by_fkey(full_name), approver:profiles!approvals_approver_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(1000));
    return groupSteps(rows as unknown as Step[]);
  });

  const requests = data ?? [];
  const pendingCount = requests.filter((r) => r.overall === "pending").length;
  const list = useMemo(() => requests.filter((r) =>
    (view === "pending" ? r.overall === "pending" : r.overall !== "pending") && (type === "all" || r.type === type),
  ), [requests, view, type]);
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of requests) if ((view === "pending") === (r.overall === "pending")) c[r.type] = (c[r.type] ?? 0) + 1;
    return c;
  }, [requests, view]);

  useEffect(() => {
    const id = params.get("id");
    if (id && requests.some((r) => r.group === id)) {
      setSelected(id);
      const r = requests.find((x) => x.group === id)!;
      setView(r.overall === "pending" ? "pending" : "history");
    }
  }, [params, requests]);

  const current = requests.find((r) => r.group === selected) ?? null;
  const select = (g: string) => { setSelected(g); setParams({ id: g }, { replace: true }); };

  return (
    <div>
      <PageHeader title={t.approvals.title} subtitle={t.approvals.subtitle} actions={<LiveBadge />} />
      <Tabs
        tabs={[{ key: "pending", label: t.approvals.pending, count: pendingCount }, { key: "history", label: t.approvals.history }]}
        value={view}
        onChange={(v) => { setView(v); setSelected(null); }}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {TYPES.filter((ty) => ty === "all" || typeCounts[ty]).map((ty) => (
            <button key={ty} onClick={() => setType(ty)}
              className={cn("rounded-full border px-3 py-1 text-sm", type === ty ? "border-primary bg-primary text-primary-fg" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50")}>
              {t.approvals.types[ty]}{ty !== "all" && <span className="ml-1 opacity-70">{typeCounts[ty]}</span>}
            </button>
          ))}
        </div>
        <Select className="md:hidden" value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} aria-label={t.common.type}>
          {TYPES.map((ty) => <option key={ty} value={ty}>{t.approvals.types[ty]}</option>)}
        </Select>
      </div>
      {error && <div className="mb-4"><Alert tone="error">{fmt(t.common.loadError, { msg: error })}</Alert></div>}
      {loading && !data ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            {list.length === 0 ? (
              <EmptyState icon={<Inbox className="h-10 w-10" />} title={view === "pending" ? t.approvals.noPending : t.approvals.noHistory} />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {list.map((r) => (
                  <li key={r.group}>
                    <button onClick={() => select(r.group)} className={cn("flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-50", selected === r.group && "bg-primary-soft/50")}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-neutral-900">{r.title}</span>
                        {r.amount != null && <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{money(Number(r.amount))}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <Badge>{t.approvals.types[r.type as keyof typeof t.approvals.types] ?? r.type}</Badge>
                        <span>{r.requesterName}</span>
                        <span>· {timeAgo(r.lastDecided ?? r.createdAt, t)}</span>
                        {r.current?.role && <span className="text-amber-700">· {t.approvals.waitingFor}: {t.roles[r.current.role.code]}</span>}
                        {view === "history" && <StatusBadge value={r.overall} />}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="lg:col-span-3">
            {current ? <RequestDetail request={current} threshold={settings.threshold} onDecided={reload} /> : (
              <Card className="hidden lg:block"><EmptyState title={t.approvals.selectOne} /></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestDetail({ request, threshold, onDecided }: { request: Request; threshold: number; onDecided: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const auth = useAuth();
  const { money } = useCompany();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  useEffect(() => { setMsg(null); setComment(""); setRejecting(false); }, [request.group]);

  const cur = request.current;
  const isRequester = request.requestedBy === auth.session?.user.id;
  const hasRole = !!cur?.role && auth.roles.includes(cur.role.code);
  const canDecide = !!cur && hasRole && !isRequester;

  async function decide(approve: boolean) {
    if (!cur) return;
    if (!approve && !comment.trim()) return setMsg({ tone: "error", text: t.approvals.reasonRequired });
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("decide_approval", { p_approval: cur.id, p_approve: approve, p_comment: comment.trim() || null });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setRejecting(false);
    setComment("");
    setMsg({ tone: "success", text: t.approvals.done });
    await onDecided();
  }

  const icon = (s: Step) => {
    if (s.status === "approved") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    if (s.status === "rejected") return <XCircle className="h-5 w-5 text-red-600" />;
    if (s.status === "skipped" || s.status === "cancelled") return <CircleSlash className="h-5 w-5 text-neutral-400" />;
    if (s.id === cur?.id) return <Clock className="h-5 w-5 text-amber-500" />;
    return <Circle className="h-5 w-5 text-neutral-300" />;
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge>{t.approvals.types[request.type as keyof typeof t.approvals.types] ?? request.type}</Badge>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">{request.title}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {t.approvals.requestedBy} <span className="font-medium text-neutral-700">{request.requesterName}</span> · {new Date(request.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="text-right">
          {request.amount != null && <p className="text-2xl font-semibold tabular-nums text-neutral-900">{money(Number(request.amount))}</p>}
          {request.amount != null && Number(request.amount) > threshold && <p className="text-xs text-amber-700">{fmt(t.approvals.largePayment, { amount: money(threshold) })}</p>}
          <div className="mt-1"><StatusBadge value={request.overall} /></div>
        </div>
      </div>

      <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t.approvals.steps}</h3>
      <ol className="space-y-3">
        {request.steps.map((s) => (
          <li key={s.id} className="flex gap-3">
            <span className="mt-0.5">{icon(s)}</span>
            <div className="min-w-0 flex-1 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-neutral-900">{fmt(t.approvals.step, { n: s.step_order })} · {s.role ? t.roles[s.role.code] : ""}</span>
                <StatusBadge value={s.id === cur?.id ? "waiting" : s.status} />
              </div>
              {(s.approver || s.decided_at) && (
                <p className="mt-0.5 text-xs text-neutral-500">
                  {s.approver ? fmt(t.approvals.decidedBy, { name: s.approver.full_name }) : ""}{s.decided_at ? ` · ${timeAgo(s.decided_at, t)}` : ""}
                </p>
              )}
              {s.comment && <p className="mt-1 text-sm text-neutral-700">“{s.comment}”</p>}
            </div>
          </li>
        ))}
      </ol>

      {msg && !rejecting && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      {cur && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          {isRequester ? <Alert tone="info">{t.approvals.youRequested}</Alert>
            : !hasRole ? <Alert tone="info">{fmt(t.approvals.notYourStep, { role: cur.role ? t.roles[cur.role.code] : "" })}</Alert>
            : (
              <div className="space-y-3">
                <Field label={t.approvals.approveComment} htmlFor="ap-comment">
                  <Textarea id="ap-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.approvals.reasonPlaceholder} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => decide(true)} loading={busy && !rejecting} disabled={!canDecide} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-4 w-4" /> {t.approvals.approve}</Button>
                  <Button variant="danger" onClick={() => setRejecting(true)} disabled={!canDecide || busy}><X className="h-4 w-4" /> {t.approvals.reject}</Button>
                </div>
              </div>
            )}
        </div>
      )}

      <Modal open={rejecting} onClose={() => setRejecting(false)} title={t.approvals.rejectTitle}
        footer={<><Button variant="secondary" onClick={() => setRejecting(false)}>{t.app.cancel}</Button><Button variant="danger" loading={busy} onClick={() => decide(false)}>{t.approvals.reject}</Button></>}>
        <Field label={t.approvals.reason} htmlFor="rej-reason">
          <Textarea id="rej-reason" required autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.approvals.reasonPlaceholder} />
        </Field>
        {msg?.tone === "error" && <div className="mt-3"><Alert tone="error">{msg.text}</Alert></div>}
      </Modal>
    </Card>
  );
}
