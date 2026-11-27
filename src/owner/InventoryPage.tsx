import { useState } from "react";
import { AlertTriangle, Boxes, PackageX } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCompany } from "@/features/settings/CompanySettings";
import { PageHeader } from "@/components/ui";
import { DemoBadge, ProgressBar, Section, StatCard, StatusBadge, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { BarChartCard } from "@/components/charts";
import { inventoryDemo as d } from "@/demo/ownerDemo";

type Tab = "stock" | "moves" | "low" | "damaged" | "issued";

export function InventoryPage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<Tab>("stock");
  const items = d.items.map((i) => ({ ...i, value: i.onHand * i.unitCost, low: i.onHand <= i.reorder }));
  const low = items.filter((i) => i.low);
  const lost = d.movements.filter((m) => m.condition !== "ok");
  const cost = (name: string) => d.items.find((i) => i.name === name)?.unitCost ?? 0;
  const issued = d.movements.filter((m) => m.direction === "out" && m.project !== "—" && m.condition === "ok");
  const byProject = Object.entries(issued.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.project]: (acc[m.project] ?? 0) + m.qty * cost(m.item) }), {}))
    .map(([project, value]) => ({ project, value }));

  return (
    <div>
      <PageHeader title={t.inventory.title} subtitle={t.inventory.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.inventory.stockValue} value={money(items.reduce((s, i) => s + i.value, 0))} icon={<Boxes className="h-4 w-4" />} demo />
        <StatCard label={t.inventory.itemsCount} value={items.length} />
        <StatCard label={t.inventory.lowCount} value={low.length} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label={t.inventory.lossValue} value={money(lost.reduce((s, m) => s + Math.abs(m.qty) * cost(m.item), 0))} icon={<PackageX className="h-4 w-4" />} tone="amber" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "stock", label: t.inventory.tabStock }, { key: "moves", label: t.inventory.tabMoves }, { key: "low", label: t.inventory.tabLow, count: low.length },
        { key: "damaged", label: t.inventory.tabDamaged, count: lost.length }, { key: "issued", label: t.inventory.tabIssued },
      ]} />

      {tab === "stock" && (
        <DataTable rows={items} rowKey={(r) => r.id} exportName="stock" pageSize={12}
          filters={[{ key: "category", label: t.common.category, options: [...new Set(items.map((i) => i.category))].map((c) => ({ value: c, label: c })) }]}
          columns={[
            { key: "sku", label: t.inventory.sku, hideOnMobile: true },
            { key: "name", label: t.inventory.item, primary: true },
            { key: "category", label: t.common.category },
            { key: "onHand", label: t.inventory.onHand, render: (r) => <span className={r.low ? "font-semibold text-red-600" : ""}>{r.onHand.toLocaleString()} {r.unit}</span>, value: (r) => r.onHand },
            { key: "reorder", label: t.inventory.reorderLevel, kind: "number" },
            { key: "unitCost", label: t.inventory.unitCost, kind: "money" },
            { key: "value", label: t.inventory.value, kind: "money" },
            { key: "location", label: t.common.location, hideOnMobile: true },
          ]} />
      )}
      {tab === "moves" && (
        <DataTable rows={d.movements} rowKey={(r) => r.id} exportName="stock-movements"
          filters={[{ key: "direction", label: t.inventory.direction, options: ["in", "out", "adjust"].map((s) => ({ value: s, label: statusLabel(t, s) })) }]}
          columns={[
            { key: "date", label: t.common.date, kind: "datetime" },
            { key: "item", label: t.inventory.item, primary: true },
            { key: "direction", label: t.inventory.direction, kind: "status" },
            { key: "qty", label: t.common.quantity, render: (r) => `${r.qty.toLocaleString()} ${r.unit}`, value: (r) => r.qty },
            { key: "project", label: t.common.project },
            { key: "condition", label: t.inventory.condition, kind: "status" },
            { key: "by", label: t.inventory.recordedBy, hideOnMobile: true },
          ]} />
      )}
      {tab === "low" && (
        <DataTable rows={low} rowKey={(r) => r.id} exportName="low-stock" searchable={false} emptyTitle={t.common.noResults}
          columns={[
            { key: "name", label: t.inventory.item, primary: true },
            { key: "onHand", label: t.inventory.onHand, render: (r) => `${r.onHand} ${r.unit}`, value: (r) => r.onHand },
            { key: "reorder", label: t.inventory.reorderLevel, render: (r) => `${r.reorder} ${r.unit}`, value: (r) => r.reorder },
            { key: "level", label: t.common.progress, render: (r) => <ProgressBar value={(r.onHand / r.reorder) * 100} tone="red" /> },
            { key: "short", label: t.inventory.shortBy, render: (r) => <span className="font-medium text-red-600">{r.reorder - r.onHand} {r.unit}</span>, value: (r) => r.reorder - r.onHand },
          ]} />
      )}
      {tab === "damaged" && (
        <DataTable rows={lost} rowKey={(r) => r.id} exportName="damaged-missing" searchable={false}
          columns={[
            { key: "date", label: t.common.date, kind: "date" },
            { key: "item", label: t.inventory.item, primary: true },
            { key: "qty", label: t.common.quantity, render: (r) => `${Math.abs(r.qty)} ${r.unit}`, value: (r) => Math.abs(r.qty) },
            { key: "condition", label: t.inventory.condition, render: (r) => <StatusBadge value={r.condition} />, value: (r) => r.condition },
            { key: "loss", label: t.inventory.lossValue, kind: "money", value: (r) => Math.abs(r.qty) * cost(r.item) },
            { key: "project", label: t.common.project },
          ]} />
      )}
      {tab === "issued" && (
        <div className="space-y-4">
          <Section title={t.inventory.tabIssued} demo><BarChartCard money data={byProject} x="project" series={[{ key: "value", label: t.inventory.value, color: "#f59e0b" }]} /></Section>
          <DataTable rows={issued} rowKey={(r) => r.id} exportName="issued-to-site"
            columns={[
              { key: "date", label: t.common.date, kind: "date" },
              { key: "project", label: t.common.project, primary: true },
              { key: "stage", label: t.inventory.stage, render: (r) => <span className="capitalize">{r.stage}</span> },
              { key: "item", label: t.inventory.item },
              { key: "qty", label: t.common.quantity, render: (r) => `${r.qty.toLocaleString()} ${r.unit}`, value: (r) => r.qty },
              { key: "value", label: t.inventory.value, kind: "money", value: (r) => r.qty * cost(r.item) },
            ]} />
        </div>
      )}
    </div>
  );
}
