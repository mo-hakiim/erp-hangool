import { useMemo, useState } from "react";
import { BarChart3, Boxes, Building2, Download, FileText, HardHat, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { cn } from "@/lib/format";
import { exportCsv, exportPdf } from "@/lib/export";
import { useCompany } from "@/features/settings/CompanySettings";
import { Button, Card, PageHeader } from "@/components/ui";
import { DemoBadge, Section } from "@/components/blocks";
import { financeDemo, hrDemo, inventoryDemo, overviewDemo, procurementDemo, realEstateDemo } from "@/demo/ownerDemo";

type Cat = "financial" | "project" | "procurement" | "inventory" | "hr" | "realEstate";
type Period = "daily" | "weekly" | "monthly";
const icons: Record<Cat, LucideIcon> = { financial: BarChart3, project: HardHat, procurement: ShoppingCart, inventory: Boxes, hr: Users, realEstate: Building2 };

export function ReportsPage() {
  const { t, locale } = useI18n();
  const { money } = useCompany();
  const [cat, setCat] = useState<Cat>("financial");
  const [period, setPeriod] = useState<Period>("monthly");

  const periodLabel = useMemo(() => {
    const now = new Date();
    if (period === "daily") return now.toLocaleDateString(locale, { dateStyle: "full" });
    if (period === "weekly") {
      const start = new Date(now.getTime() - 6 * 86_400_000);
      return `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${now.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return now.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }, [period, locale]);

  // Each report = header + rows (sample data until reports read live tables).
  const report = useMemo((): { head: string[]; rows: string[][] } => {
    const m = (n: number) => money(n);
    switch (cat) {
      case "financial": return {
        head: [t.common.period, t.finance.income, t.finance.expenses, t.finance.net],
        rows: financeDemo.monthly.slice(-6).reverse().map((r) => [r.month, m(r.income), m(r.expenses), m(r.income - r.expenses)]),
      };
      case "project": return {
        head: [t.common.project, t.common.progress, t.overview.budget, t.overview.actual],
        rows: overviewDemo.projectProgress.map((p, i) => [p.name, `${p.progress}%`, m(overviewDemo.budgetVsActual[i]?.budget ?? 0), m(overviewDemo.budgetVsActual[i]?.actual ?? 0)]),
      };
      case "procurement": return {
        head: [t.procurement.poNumber, t.procurement.supplier, t.common.project, t.common.amount, t.common.status],
        rows: procurementDemo.orders.map((o) => [o.no, o.supplier, o.project, m(o.total), o.status]),
      };
      case "inventory": return {
        head: [t.inventory.item, t.inventory.onHand, t.inventory.reorderLevel, t.inventory.value],
        rows: inventoryDemo.items.map((i) => [i.name, `${i.onHand} ${i.unit}`, String(i.reorder), m(i.onHand * i.unitCost)]),
      };
      case "hr": return {
        head: [t.common.name, t.hr.department, t.hr.gross, t.hr.net],
        rows: hrDemo.payroll.map((p) => [p.name, hrDemo.employees.find((e) => e.name === p.name)?.department ?? "—", m(p.gross), m(p.net)]),
      };
      case "realEstate": return {
        head: [t.realEstate.tenant, t.realEstate.unit, t.common.amount, t.common.status],
        rows: realEstateDemo.rentPayments.map((r) => [r.tenant, r.unit, m(r.amount), r.status]),
      };
    }
  }, [cat, period, t, money]);

  const title = `${t.reports.categories[cat]} — ${t.reports[period]}`;

  return (
    <div>
      <PageHeader title={t.reports.title} subtitle={t.reports.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", period === p ? "bg-ink-900 text-white" : "text-slate-600 hover:bg-slate-100")}>{t.reports[p]}</button>
        ))}
      </div>
      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(icons) as Cat[]).map((c) => {
          const Icon = icons[c];
          return (
            <li key={c}>
              <button onClick={() => setCat(c)} className="h-full w-full text-left">
                <Card className={cn("h-full p-4 transition-colors hover:border-brand-300", cat === c && "border-brand-500 ring-1 ring-brand-500")}>
                  <Icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-2 font-medium text-slate-900">{t.reports.categories[c]}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.reports.descriptions[c]}</p>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>
      <Section title={`${t.reports.preview}: ${title}`} demo actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => exportCsv(`report-${cat}-${period}`, report.head, report.rows)}><Download className="h-4 w-4" /> {t.reports.exportExcel}</Button>
          <Button size="sm" onClick={() => exportPdf(title, report.head, report.rows, fmt(t.reports.generatedFor, { period: periodLabel }))}><FileText className="h-4 w-4" /> {t.reports.exportPdf}</Button>
        </div>
      }>
        <p className="mb-3 text-sm text-slate-500">{fmt(t.reports.generatedFor, { period: periodLabel })}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50"><tr>{report.head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cn("whitespace-nowrap px-3 py-2", j === 0 ? "font-medium text-slate-900" : "text-slate-700")}>{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
