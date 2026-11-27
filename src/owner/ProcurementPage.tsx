import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCompany } from "@/features/settings/CompanySettings";
import { Badge, PageHeader } from "@/components/ui";
import { DemoBadge, Section, StatCard, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { BarChartCard, brandColor } from "@/components/charts";
import { procurementDemo as d } from "@/demo/ownerDemo";

type Tab = "requests" | "quotes" | "orders" | "suppliers" | "history";

export function ProcurementPage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<Tab>("requests");
  const opts = (xs: string[]) => xs.map((s) => ({ value: s, label: statusLabel(t, s) }));
  const best = new Map<string, number>();
  for (const q of d.quotes) best.set(q.request, Math.min(best.get(q.request) ?? Infinity, q.total));

  return (
    <div>
      <PageHeader title={t.procurement.title} subtitle={t.procurement.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.overview.openRequests} value={d.requests.filter((r) => ["submitted", "pm_approved", "sourcing"].includes(r.status)).length} tone="amber" demo />
        <StatCard label={t.overview.awaitingDelivery} value={d.orders.filter((o) => ["approved", "ordered", "waiting"].includes(o.status)).length} tone="blue" />
        <StatCard label={t.procurement.orders} value={d.orders.length} />
        <StatCard label={t.procurement.totalSpent} value={money(d.suppliers.reduce((s, x) => s + x.spent, 0), { compact: true })} tone="green" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "requests", label: t.procurement.tabRequests, count: d.requests.length }, { key: "quotes", label: t.procurement.tabQuotes, count: d.quotes.length },
        { key: "orders", label: t.procurement.tabOrders, count: d.orders.length }, { key: "suppliers", label: t.procurement.tabSuppliers, count: d.suppliers.length },
        { key: "history", label: t.procurement.tabHistory },
      ]} />

      {tab === "requests" && (
        <DataTable rows={d.requests} rowKey={(r) => r.id} exportName="material-requests"
          filters={[{ key: "status", label: t.common.status, options: opts(["submitted", "pm_approved", "sourcing", "ordered", "delivered", "issued", "rejected"]) }]}
          columns={[
            { key: "no", label: t.procurement.requestNo, primary: true },
            { key: "project", label: t.common.project, render: (r) => <><p>{r.project}</p><p className="text-xs capitalize text-neutral-500">{r.stage}</p></>, value: (r) => `${r.project} ${r.stage}` },
            { key: "requestedBy", label: t.procurement.requestedBy, hideOnMobile: true },
            { key: "neededBy", label: t.procurement.neededBy, kind: "date" },
            { key: "items", label: t.procurement.items, kind: "number" },
            { key: "total", label: t.common.amount, kind: "money" },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "quotes" && (
        <DataTable rows={d.quotes} rowKey={(r) => r.id} exportName="quotes"
          columns={[
            { key: "request", label: t.procurement.requestNo, primary: true },
            { key: "supplier", label: t.procurement.supplier },
            { key: "total", label: t.procurement.quoteTotal, kind: "money", render: (r) => <span className={best.get(r.request) === r.total ? "font-semibold text-emerald-700" : ""}>{money(r.total)}{best.get(r.request) === r.total && <Badge tone="green" className="ml-1">{t.procurement.best}</Badge>}</span> },
            { key: "validUntil", label: t.procurement.validUntil, kind: "date" },
            { key: "selected", label: t.procurement.selected, render: (r) => (r.selected ? <Check className="h-4 w-4 text-emerald-600" /> : "—"), value: (r) => (r.selected ? t.common.yes : t.common.no) },
          ]} />
      )}
      {tab === "orders" && (
        <DataTable rows={d.orders} rowKey={(r) => r.id} exportName="purchase-orders"
          filters={[{ key: "status", label: t.common.status, options: opts(["waiting", "approved", "ordered", "delivered", "cancelled"]) }]}
          columns={[
            { key: "no", label: t.procurement.poNumber, primary: true },
            { key: "supplier", label: t.procurement.supplier },
            { key: "project", label: t.common.project, hideOnMobile: true },
            { key: "created", label: t.common.date, kind: "date", hideOnMobile: true },
            { key: "expected", label: t.procurement.expected, kind: "date" },
            { key: "total", label: t.common.amount, kind: "money" },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "suppliers" && (
        <div className="space-y-4">
          <Section title={t.procurement.spendBySupplier} demo>
            <BarChartCard money horizontal height={240} data={d.suppliers.map((s) => ({ name: s.name, spent: s.spent }))} x="name" series={[{ key: "spent", label: t.procurement.totalSpent, color: brandColor("primary") }]} />
          </Section>
          <DataTable rows={d.suppliers} rowKey={(r) => r.id} exportName="suppliers"
            filters={[{ key: "category", label: t.common.category, options: [...new Set(d.suppliers.map((s) => s.category))].map((c) => ({ value: c, label: c })) }]}
            columns={[
              { key: "name", label: t.common.name, primary: true },
              { key: "contact", label: t.procurement.contact, render: (r) => <><p>{r.contact}</p><p className="text-xs text-neutral-500">{r.phone}</p></>, value: (r) => `${r.contact} ${r.phone}` },
              { key: "category", label: t.common.category },
              { key: "terms", label: t.procurement.terms, hideOnMobile: true },
              { key: "orders", label: t.procurement.orders, kind: "number" },
              { key: "spent", label: t.procurement.totalSpent, kind: "money" },
              { key: "status", label: t.common.status, kind: "status" },
            ]} />
        </div>
      )}
      {tab === "history" && (
        <Section title={t.procurement.tabHistory} demo>
          <BarChartCard money stacked data={d.history} x="month" series={d.historySeries} />
        </Section>
      )}
    </div>
  );
}
