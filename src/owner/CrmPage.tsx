import { useState } from "react";
import { MessageSquare, Phone, Mail, MapPin } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { formatDate, timeAgo } from "@/lib/format";
import { useCompany } from "@/features/settings/CompanySettings";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { DemoBadge, ProgressBar, Section, StatCard, StatusBadge, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { crmDemo as d } from "@/demo/ownerDemo";

const PIPELINE = ["new", "contacted", "visiting", "signed", "lost"] as const;

export function CrmPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"clients" | "pipeline">("clients");
  return (
    <div>
      <PageHeader title={t.crm.title} subtitle={t.crm.subtitle} actions={<DemoBadge />} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "clients", label: t.crm.tabClients, count: d.clients.length }, { key: "pipeline", label: t.crm.tabPipeline, count: d.leads.length }]} />
      {tab === "clients" ? <Clients /> : <Pipeline />}
    </div>
  );
}

function Clients() {
  const { t, locale } = useI18n();
  const { money } = useCompany();
  const [selected, setSelected] = useState<string | null>(d.clients[0]?.id ?? null);
  const c = d.clients.find((x) => x.id === selected);
  const rows = d.clients.map((x) => ({ ...x, balance: x.contractValue - x.paid, projectCount: x.projects.length }));

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <DataTable rows={rows} rowKey={(r) => r.id} selectedKey={selected} onRowClick={(r) => setSelected(r.id)} exportName="clients" pageSize={8}
          columns={[
            { key: "name", label: t.common.name, primary: true },
            { key: "projectCount", label: t.crm.projects, kind: "number" },
            { key: "balance", label: t.crm.balance, kind: "money" },
          ]} />
      </div>
      <div className="xl:col-span-3">
        {!c ? <Card><EmptyState title={t.crm.selectClient} /></Card> : (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{c.name}</h2>
                  <p className="text-sm text-neutral-500">{fmt(t.crm.clientSince, { date: formatDate(c.since, locale) })}</p>
                </div>
                <DemoBadge />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone}</span>
                <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.address}</span>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label={t.crm.totalValue} value={money(c.contractValue)} />
              <StatCard label={t.crm.payments} value={money(c.paid)} tone="green" />
              <StatCard label={t.crm.balance} value={money(c.contractValue - c.paid)} tone={c.contractValue - c.paid > 0 ? "amber" : "green"} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={t.crm.projects}>
                <ul className="space-y-3">{c.projects.map((p) => (
                  <li key={p.code}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="font-medium text-neutral-900">{p.name}</span><StatusBadge value={p.status} /></div><ProgressBar value={p.progress} /></li>
                ))}</ul>
              </Section>
              <Section title={t.crm.contracts}>
                <ul className="divide-y divide-neutral-100 text-sm">{c.contracts.map((k) => (
                  <li key={k.no} className="flex items-center justify-between gap-2 py-2"><span><span className="font-medium">{k.no}</span><br /><span className="text-xs text-neutral-500">{formatDate(k.signed, locale)}</span></span><span className="text-right">{money(k.value)}<br /><StatusBadge value={k.status} /></span></li>
                ))}</ul>
              </Section>
              <Section title={t.crm.payments}>
                <ul className="divide-y divide-neutral-100 text-sm">{c.payments.map((p, i) => (
                  <li key={i} className="flex justify-between py-2"><span>{formatDate(p.date, locale)} · <span className="text-neutral-500">{p.method}</span></span><span className="font-medium tabular-nums">{money(p.amount)}</span></li>
                ))}</ul>
              </Section>
              <Section title={t.crm.complaints}>
                {c.complaints.length === 0 ? <p className="text-sm text-neutral-500">{t.crm.noComplaints}</p> : (
                  <ul className="space-y-2 text-sm">{c.complaints.map((k, i) => (
                    <li key={i} className="flex justify-between gap-2"><span>{k.subject}<br /><span className="text-xs text-neutral-500">{timeAgo(k.date, t)}</span></span><StatusBadge value={k.status} /></li>
                  ))}</ul>
                )}
              </Section>
            </div>
            <Section title={t.crm.messages} actions={<MessageSquare className="h-4 w-4 text-neutral-400" />}>
              {c.messages.length === 0 ? <p className="text-sm text-neutral-500">{t.crm.noMessages}</p> : (
                <ul className="space-y-3">{c.messages.map((m, i) => (
                  <li key={i} className={m.from === c.name ? "mr-10" : "ml-10"}>
                    <div className={`rounded-xl px-3 py-2 text-sm ${m.from === c.name ? "bg-neutral-100" : "bg-primary-soft"}`}>{m.body}</div>
                    <p className="mt-0.5 text-[11px] text-neutral-400">{m.from} · {timeAgo(m.date, t)}</p>
                  </li>
                ))}</ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Pipeline() {
  const { t } = useI18n();
  const { money } = useCompany();
  const won = d.leads.filter((l) => l.status === "signed").length;
  const closed = d.leads.filter((l) => ["signed", "lost"].includes(l.status)).length;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.marketing.leads} value={d.leads.length} demo />
        <StatCard label={statusLabel(t, "signed")} value={won} tone="green" />
        <StatCard label={statusLabel(t, "lost")} value={d.leads.filter((l) => l.status === "lost").length} tone="red" />
        <StatCard label={t.marketing.conversion} value={`${closed ? Math.round((won / closed) * 100) : 0}%`} tone="amber" />
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {PIPELINE.map((stage) => {
          const leads = d.leads.filter((l) => l.status === stage);
          return (
            <div key={stage} className="w-72 shrink-0 snap-start rounded-xl bg-neutral-100 p-2 lg:w-auto">
              <div className="mb-2 flex items-center justify-between px-1">
                <StatusBadge value={stage} />
                <span className="text-xs text-neutral-500">{fmt(t.crm.leads, { n: leads.length })}</span>
              </div>
              <ul className="space-y-2">
                {leads.map((l) => (
                  <li key={l.id} className="rounded-xl border border-neutral-200 bg-surface p-3 shadow-card">
                    <p className="font-medium text-neutral-900">{l.name}</p>
                    <p className="text-xs text-neutral-500">{l.phone}</p>
                    <div className="mt-2 flex flex-wrap gap-1"><Badge>{l.source}</Badge><Badge tone="blue">{l.interest.replace("_", " ")}</Badge></div>
                    <div className="mt-2 flex justify-between text-xs text-neutral-500"><span>{money(l.budget)}</span><span>{l.assigned} · {timeAgo(l.created, t)}</span></div>
                    {"lostReason" in l && l.lostReason && <p className="mt-1 text-xs text-red-600">{t.crm.lostReason}: {l.lostReason}</p>}
                  </li>
                ))}
                {leads.length === 0 && <li className="px-1 py-4 text-center text-xs text-neutral-400">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
