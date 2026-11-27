import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, Building2, CheckSquare, HardHat, Landmark, PackageX, ShoppingCart, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, useI18n } from "@/i18n";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";
import { useCompany } from "@/features/settings/CompanySettings";
import { useNotifications } from "@/features/notifications/NotificationsProvider";
import { PageHeader } from "@/components/ui";
import { ProgressBar, Section, StatCard } from "@/components/blocks";
import { BarChartCard, DonutChartCard, LineChartCard } from "@/components/charts";
import { overviewDemo as d } from "@/demo/ownerDemo";
import { useLoad } from "./useQuery";

export function OverviewPage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const auth = useAuth();
  const { items } = useNotifications();

  // REAL: pending approval requests (distinct groups) and how many wait on one of my roles.
  const approvals = useLoad(async () => {
    const { data } = await supabase.from("approvals").select("request_group, status, step_order, role:roles(code)").eq("status", "pending");
    const rows = (data ?? []) as unknown as Array<{ request_group: string; step_order: number; role: { code: string } | null }>;
    const first = new Map<string, { step_order: number; code: string }>();
    for (const r of rows) {
      const cur = first.get(r.request_group);
      if (!cur || r.step_order < cur.step_order) first.set(r.request_group, { step_order: r.step_order, code: r.role?.code ?? "" });
    }
    const mine = [...first.values()].filter((x) => auth.roles.includes(x.code as never)).length;
    return { total: first.size, mine };
  });

  const k = d.kpis;
  const last = d.monthly.at(-1)!, prev = d.monthly.at(-2)!;
  const profitTrend = Math.round(((last.profit - prev.profit) / prev.profit) * 100);

  return (
    <div>
      <PageHeader title={t.overview.title} subtitle={t.overview.subtitle} />

      {/* money */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t.overview.revenue} value={money(k.revenue, { compact: true })} trend={k.revenueTrend} icon={<TrendingUp className="h-4 w-4" />} tone="green" demo />
        <StatCard label={t.overview.expenses} value={money(k.expenses, { compact: true })} trend={k.expensesTrend} icon={<TrendingDown className="h-4 w-4" />} tone="red" demo />
        <StatCard label={t.overview.cash} value={money(k.cash, { compact: true })} icon={<Wallet className="h-4 w-4" />} demo />
        <StatCard label={t.overview.bank} value={money(k.bank, { compact: true })} icon={<Landmark className="h-4 w-4" />} demo />
        <StatCard label={t.overview.receivable} value={money(k.receivable, { compact: true })} icon={<Banknote className="h-4 w-4" />} tone="amber" demo />
        <StatCard label={t.overview.payable} value={money(k.payable, { compact: true })} icon={<Banknote className="h-4 w-4" />} tone="blue" demo />
      </div>

      {/* approvals + projects */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/owner/approvals" className="col-span-2 lg:col-span-1">
          <StatCard label={t.overview.pendingApprovals} value={approvals.data?.total ?? "…"} live
            hint={approvals.data ? `${approvals.data.mine} ${t.overview.waitingForYou}` : undefined} icon={<CheckSquare className="h-4 w-4" />} tone="amber" />
        </Link>
        <StatCard label={`${t.overview.projects} · ${t.overview.activeProjects}`} value={d.projects.active} icon={<HardHat className="h-4 w-4" />} tone="blue" demo />
        <StatCard label={t.overview.completedProjects} value={d.projects.completed} tone="green" demo />
        <StatCard label={t.overview.delayedProjects} value={d.projects.delayed} icon={<AlertTriangle className="h-4 w-4" />} tone="red" demo />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Section title={t.overview.monthly} demo className="lg:col-span-2">
          <LineChartCard money area data={d.monthly} x="month" series={[
            { key: "income", label: t.overview.income, color: "#0d9488" },
            { key: "expenses", label: t.finance.expenses, color: "#e11d48" },
            { key: "profit", label: t.overview.profit, color: "#f59e0b" },
          ]} />
          <p className="mt-2 text-xs text-slate-500">{t.overview.profit}: <span className="font-semibold text-slate-800">{money(last.profit)}</span> <span className={profitTrend >= 0 ? "text-emerald-600" : "text-red-600"}>({profitTrend >= 0 ? "+" : ""}{profitTrend}% {t.overview.vsLastMonth})</span></p>
        </Section>
        <Section title={t.overview.latestNotifications} live actions={<Link to="/notifications" className="text-xs font-medium text-brand-700 hover:underline">{t.common.viewAll}</Link>}>
          {items.length === 0 ? <p className="text-sm text-slate-500">{t.shell.noNotifications}</p> : (
            <ul className="space-y-3">
              {items.slice(0, 5).map((n) => (
                <li key={n.id} className="flex gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-slate-200" : "bg-brand-500"}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500">{timeAgo(n.created_at, t)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title={t.overview.projectProgress} demo>
          <ul className="space-y-3">
            {d.projectProgress.map((p) => (
              <li key={p.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate text-slate-800">{p.name}</span>
                  {p.progress < p.planned - 3 && <span className="text-xs font-medium text-red-600">{t.projects.delayed}</span>}</div>
                <ProgressBar value={p.progress} tone={p.progress < p.planned - 3 ? "red" : "brand"} />
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t.overview.budgetVsActual} demo>
          <BarChartCard money data={d.budgetVsActual} x="project" series={[{ key: "budget", label: t.overview.budget, color: "#cbd5e1" }, { key: "actual", label: t.overview.actual, color: "#0f172a" }]} />
        </Section>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Section title={t.overview.attendanceToday} demo>
          <DonutChartCard height={150} data={[
            { name: t.overview.present, value: d.attendance.present, color: "#0d9488" },
            { name: t.overview.absent, value: d.attendance.absent, color: "#e11d48" },
            { name: t.overview.onLeave, value: d.attendance.onLeave, color: "#f59e0b" },
          ]} />
          <p className="mt-3 text-xs text-slate-500"><Users className="mr-1 inline h-3.5 w-3.5" />{t.hr.labourToday}: <span className="font-semibold text-slate-800">{d.attendance.labourers}</span></p>
        </Section>
        <Section title={t.overview.payrollSummary} demo>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{money(d.payroll.total)}</p>
          <p className="text-sm text-slate-500">{fmt(t.overview.staffPaid, { n: d.payroll.staff })} · {d.payroll.month}</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.construction}</span><span className="font-medium">{d.construction.onSchedule}% {t.overview.onTime}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.stagesDone}</span><span className="font-medium">{d.construction.stagesDone}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.avgProgress}</span><span className="font-medium">{d.construction.avgProgress}%</span></div>
          </div>
        </Section>
        <Section title={t.overview.realEstate} demo actions={<Building2 className="h-4 w-4 text-slate-400" />}>
          <p className="text-sm text-slate-500">{t.overview.occupancy}</p>
          <ProgressBar value={d.realEstate.occupancy} tone="green" />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.rentCollected}</span><span className="font-medium">{money(d.realEstate.rentCollected)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t.realEstate.rentDue}</span><span className="font-medium text-red-600">{money(d.realEstate.rentDue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.unitsSold}</span><span className="font-medium">{d.realEstate.unitsSold}</span></div>
          </div>
        </Section>
        <Section title={t.overview.procurement} demo actions={<ShoppingCart className="h-4 w-4 text-slate-400" />}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.openRequests}</span><span className="font-medium">{d.procurement.openRequests}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t.overview.awaitingDelivery}</span><span className="font-medium">{d.procurement.awaitingDelivery}</span></div>
          </div>
          <p className="mb-2 mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-red-600"><PackageX className="h-3.5 w-3.5" /> {t.overview.lowStock}</p>
          <ul className="space-y-1.5 text-sm">
            {d.lowStock.map((s) => (
              <li key={s.item} className="flex justify-between gap-2"><span className="truncate text-slate-700">{s.item}</span><span className="shrink-0 tabular-nums text-red-600">{s.onHand}/{s.reorder} {s.unit}</span></li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
