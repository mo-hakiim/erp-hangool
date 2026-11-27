import { useState } from "react";
import { Globe, Megaphone, MessageCircle, Target } from "lucide-react";
import { useI18n } from "@/i18n";
import { timeAgo } from "@/lib/format";
import { useCompany } from "@/features/settings/CompanySettings";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DemoBadge, ProgressBar, Section, StatCard, StatusBadge, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { DonutChartCard } from "@/components/charts";
import { crmDemo, marketingDemo as d } from "@/demo/ownerDemo";

type Tab = "leads" | "campaigns" | "followups" | "inquiries";

export function MarketingPage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<Tab>("leads");
  const spent = d.campaigns.reduce((s, c) => s + c.spent, 0);
  const leads = d.campaigns.reduce((s, c) => s + c.leads, 0);

  return (
    <div>
      <PageHeader title={t.marketing.title} subtitle={t.marketing.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.marketing.leads} value={d.leadsBySource.reduce((s, x) => s + x.value, 0)} icon={<Target className="h-4 w-4" />} demo />
        <StatCard label={t.marketing.spent} value={money(spent)} icon={<Megaphone className="h-4 w-4" />} tone="amber" />
        <StatCard label={t.marketing.costPerLead} value={money(leads ? spent / leads : 0)} tone="blue" />
        <StatCard label={t.marketing.overdue} value={d.followUps.filter((f) => f.status === "overdue").length} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "leads", label: t.marketing.tabLeads }, { key: "campaigns", label: t.marketing.tabCampaigns, count: d.campaigns.length },
        { key: "followups", label: t.marketing.tabFollowUps, count: d.followUps.filter((f) => f.status !== "done").length },
        { key: "inquiries", label: t.marketing.tabInquiries, count: d.inquiries.filter((i) => i.status === "new").length },
      ]} />

      {tab === "leads" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title={t.marketing.leadsBySource} demo><DonutChartCard height={170} data={d.leadsBySource} /></Section>
          <div className="lg:col-span-2">
            <DataTable rows={crmDemo.leads} rowKey={(r) => r.id} exportName="leads"
              filters={[
                { key: "status", label: t.common.status, options: ["new", "contacted", "visiting", "signed", "lost"].map((s) => ({ value: s, label: statusLabel(t, s) })) },
                { key: "source", label: t.crm.source, options: [...new Set(crmDemo.leads.map((l) => l.source))].map((s) => ({ value: s, label: s })) },
              ]}
              columns={[
                { key: "name", label: t.common.name, primary: true, render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.phone}</p></>, value: (r) => `${r.name} ${r.phone}` },
                { key: "source", label: t.crm.source },
                { key: "interest", label: t.crm.interest, render: (r) => r.interest.replace("_", " ") },
                { key: "budget", label: t.crm.budget, kind: "money" },
                { key: "assigned", label: t.crm.assigned, hideOnMobile: true },
                { key: "status", label: t.common.status, kind: "status" },
              ]} />
          </div>
        </div>
      )}
      {tab === "campaigns" && (
        <ul className="grid gap-4 md:grid-cols-2">
          {d.campaigns.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{c.name}</p><p className="text-sm text-slate-500">{c.channel}</p></div><StatusBadge value={c.status} /></div>
                <div className="mt-3"><p className="mb-1 text-xs text-slate-500">{t.marketing.spent} {money(c.spent)} / {money(c.budget)}</p><ProgressBar value={(c.spent / c.budget) * 100} /></div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[11px] uppercase text-slate-500">{t.marketing.leads}</dt><dd className="text-lg font-semibold">{c.leads}</dd></div>
                  <div><dt className="text-[11px] uppercase text-slate-500">{t.marketing.signed}</dt><dd className="text-lg font-semibold">{c.signed}</dd></div>
                  <div><dt className="text-[11px] uppercase text-slate-500">{t.marketing.costPerLead}</dt><dd className="text-lg font-semibold">{c.leads ? money(c.spent / c.leads) : "—"}</dd></div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {tab === "followups" && (
        <DataTable rows={d.followUps} rowKey={(r) => r.id} exportName="follow-ups"
          columns={[
            { key: "due", label: t.marketing.due, kind: "datetime" },
            { key: "lead", label: t.marketing.tabLeads, primary: true },
            { key: "note", label: t.common.notes },
            { key: "assigned", label: t.crm.assigned },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "inquiries" && (
        <ul className="space-y-3">
          {d.inquiries.map((q) => (
            <li key={q.id}>
              <Card className="flex gap-3 p-4">
                <span className={`mt-0.5 rounded-full p-2 ${q.channel === "whatsapp" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}`}>
                  {q.channel === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-900">{q.name}</p><StatusBadge value={q.status} /></div>
                  <p className="mt-1 text-sm text-slate-700">{q.message}</p>
                  <p className="mt-1 text-xs text-slate-500"><Badge>{q.channel}</Badge> · {t.marketing.received} {timeAgo(q.received, t)}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
