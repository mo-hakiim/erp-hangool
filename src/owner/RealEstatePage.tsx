import { useState } from "react";
import { Building2, CalendarClock, Home, KeyRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCompany } from "@/features/settings/CompanySettings";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DemoBadge, ProgressBar, StatCard, StatusBadge, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { realEstateDemo as d } from "@/demo/ownerDemo";

type Tab = "properties" | "tenants" | "buyers" | "agreements" | "rent" | "viewings";

export function RealEstatePage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<Tab>("properties");
  const units = d.properties.reduce((s, p) => s + (p.listing !== "sale" ? p.units : 0), 0);
  const occupied = d.properties.reduce((s, p) => s + (p.listing !== "sale" ? p.occupied : 0), 0);
  const collected = d.rentPayments.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.amount, 0);
  const due = d.rentPayments.filter((r) => r.status !== "confirmed").reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader title={t.realEstate.title} subtitle={t.realEstate.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.overview.occupancy} value={`${units ? Math.round((occupied / units) * 100) : 0}%`} hint={`${occupied}/${units}`} icon={<KeyRound className="h-4 w-4" />} tone="green" demo />
        <StatCard label={t.overview.rentCollected} value={money(collected)} tone="blue" />
        <StatCard label={t.realEstate.rentDue} value={money(due)} tone="red" />
        <StatCard label={t.realEstate.portfolio} value={money(d.properties.reduce((s, p) => s + p.price, 0), { compact: true })} icon={<Building2 className="h-4 w-4" />} tone="amber" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "properties", label: t.realEstate.tabProperties, count: d.properties.length }, { key: "tenants", label: t.realEstate.tabTenants, count: d.tenants.length },
        { key: "buyers", label: t.realEstate.tabBuyers, count: d.buyers.length }, { key: "agreements", label: t.realEstate.tabAgreements, count: d.agreements.length },
        { key: "rent", label: t.realEstate.tabRent }, { key: "viewings", label: t.realEstate.tabViewings, count: d.viewings.filter((v) => v.status === "scheduled").length },
      ]} />

      {tab === "properties" && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {d.properties.map((p) => (
            <li key={p.id}>
              <Card className="overflow-hidden">
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-600 text-neutral-300"><Home className="h-10 w-10" /></div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold text-neutral-900">{p.title}</p><StatusBadge value={p.status} /></div>
                  <p className="text-sm text-neutral-500">{p.location}</p>
                  <div className="flex flex-wrap gap-1"><Badge>{p.type.replace("_", " ")}</Badge><Badge tone="blue">{p.listing === "both" ? `${t.realEstate.sale} / ${t.realEstate.rental}` : p.listing === "sale" ? t.realEstate.sale : t.realEstate.rental}</Badge></div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">{p.price ? t.realEstate.price : t.realEstate.rent}</span>
                    <span className="font-semibold tabular-nums">{p.price ? money(p.price) : money(p.rent)}</span>
                  </div>
                  {p.listing !== "sale" && p.units > 1 && (
                    <div><p className="mb-1 text-xs text-neutral-500">{t.realEstate.occupied} {p.occupied}/{p.units}</p><ProgressBar value={(p.occupied / p.units) * 100} tone="green" /></div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {tab === "tenants" && (
        <DataTable rows={d.tenants} rowKey={(r) => r.id} exportName="tenants"
          columns={[
            { key: "name", label: t.realEstate.tenant, primary: true, render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-neutral-500">{r.phone}</p></>, value: (r) => `${r.name} ${r.phone}` },
            { key: "property", label: t.realEstate.property, render: (r) => `${r.property} · ${r.unit}`, value: (r) => `${r.property} ${r.unit}` },
            { key: "rent", label: t.realEstate.rent, kind: "money" },
            { key: "since", label: t.common.start, kind: "date", hideOnMobile: true },
            { key: "balance", label: t.common.balance, kind: "money", render: (r) => <span className={r.balance > 0 ? "font-semibold text-red-600" : ""}>{money(r.balance)}</span> },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "buyers" && (
        <DataTable rows={d.buyers.map((b) => ({ ...b, balance: b.price - b.paid }))} rowKey={(r) => r.id} exportName="buyers"
          columns={[
            { key: "name", label: t.realEstate.buyer, primary: true },
            { key: "phone", label: t.common.phone },
            { key: "property", label: t.realEstate.property },
            { key: "price", label: t.realEstate.price, kind: "money" },
            { key: "paid", label: t.finance.paid, kind: "money" },
            { key: "balance", label: t.common.balance, kind: "money" },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "agreements" && (
        <DataTable rows={d.agreements} rowKey={(r) => r.id} exportName="agreements"
          filters={[{ key: "kind", label: t.realEstate.kind, options: [{ value: "rental", label: t.realEstate.rental }, { value: "sale", label: t.realEstate.sale }] }]}
          columns={[
            { key: "no", label: t.realEstate.agreementNo, primary: true },
            { key: "kind", label: t.realEstate.kind, render: (r) => (r.kind === "sale" ? t.realEstate.sale : t.realEstate.rental) },
            { key: "party", label: `${t.realEstate.tenant} / ${t.realEstate.buyer}` },
            { key: "property", label: t.realEstate.property },
            { key: "start", label: t.common.start, kind: "date" },
            { key: "end", label: t.common.end, kind: "date", hideOnMobile: true },
            { key: "value", label: t.realEstate.value, kind: "money" },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "rent" && (
        <DataTable rows={d.rentPayments} rowKey={(r) => r.id} exportName="rent-payments"
          filters={[{ key: "status", label: t.common.status, options: ["confirmed", "pending", "overdue"].map((s) => ({ value: s, label: statusLabel(t, s) })) }]}
          columns={[
            { key: "tenant", label: t.realEstate.tenant, primary: true },
            { key: "unit", label: t.realEstate.unit },
            { key: "period", label: t.common.period, render: (r) => new Date(r.period).toLocaleDateString(undefined, { month: "long", year: "numeric" }) },
            { key: "method", label: t.common.method },
            { key: "paidAt", label: t.finance.paid, kind: "date" },
            { key: "amount", label: t.common.amount, kind: "money" },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "viewings" && (
        <DataTable rows={d.viewings} rowKey={(r) => r.id} exportName="viewings"
          columns={[
            { key: "when", label: t.realEstate.when, kind: "datetime", render: (r) => <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-neutral-400" />{new Date(r.when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span> },
            { key: "visitor", label: t.realEstate.visitor, primary: true, render: (r) => <><p className="font-medium">{r.visitor}</p><p className="text-xs text-neutral-500">{r.phone}</p></>, value: (r) => `${r.visitor} ${r.phone}` },
            { key: "property", label: t.realEstate.property },
            { key: "agent", label: t.realEstate.agent },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
    </div>
  );
}
