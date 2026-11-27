import { useState } from "react";
import { Banknote, Landmark, Smartphone, Wallet } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/format";
import { useCompany } from "@/features/settings/CompanySettings";
import { Card, PageHeader } from "@/components/ui";
import { DemoBadge, Section, StatCard, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { BarChartCard, DonutChartCard, LineChartCard } from "@/components/charts";
import { financeDemo as d } from "@/demo/ownerDemo";

type Tab = "income" | "cash" | "ar" | "ap" | "invoices" | "payments" | "receipts" | "pl" | "cashflow";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function FinancePage() {
  const { t } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<Tab>("income");
  const methodOptions = ["zaad", "edahab", "evc", "sifalo_pay", "bank", "cash"].map((m) => ({ value: m, label: m }));

  const income = sum(d.monthly.map((m) => m.income)), expenses = sum(d.monthly.map((m) => m.expenses));
  const arRows = d.receivable.map((r) => ({ ...r, total: r.current + r.d30 + r.d60 + r.d90 }));
  const apRows = d.payable.map((r) => ({ ...r, total: r.current + r.d30 + r.d60 + r.d90 }));
  const invRows = d.invoices.map((i) => ({ ...i, outstanding: i.status === "cancelled" ? 0 : i.amount - i.paid }));
  const rev = sum(d.pl.revenue.map((x) => x.amount)), cow = sum(d.pl.costOfWork.map((x) => x.amount)), opx = sum(d.pl.operating.map((x) => x.amount));

  return (
    <div>
      <PageHeader title={t.finance.title} subtitle={t.finance.subtitle} actions={<DemoBadge />} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "income", label: t.finance.tabIncome }, { key: "cash", label: t.finance.tabCash }, { key: "ar", label: t.finance.tabAr },
        { key: "ap", label: t.finance.tabAp }, { key: "invoices", label: t.finance.tabInvoices }, { key: "payments", label: t.finance.tabPayments },
        { key: "receipts", label: t.finance.tabReceipts }, { key: "pl", label: t.finance.tabPl }, { key: "cashflow", label: t.finance.tabCashflow },
      ]} />

      {tab === "income" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={t.finance.income} value={money(income)} tone="green" demo />
            <StatCard label={t.finance.expenses} value={money(expenses)} tone="red" demo />
            <StatCard label={t.finance.net} value={money(income - expenses)} tone="amber" hint={`${t.finance.margin} ${Math.round(((income - expenses) / income) * 100)}%`} demo />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <Section title={t.finance.monthlyTrend} demo className="lg:col-span-3">
              <BarChartCard money data={d.monthly} x="month" series={[{ key: "income", label: t.finance.income, color: "#0d9488" }, { key: "expenses", label: t.finance.expenses, color: "#e11d48" }]} />
            </Section>
            <Section title={t.finance.byCategory} demo className="lg:col-span-2"><DonutChartCard money data={d.expenseByCategory} /></Section>
          </div>
          <Section title={t.finance.tabIncome} demo flush>
            <div className="p-4">
              <DataTable rows={d.transactions} rowKey={(r) => r.id} exportName="income-expenses"
                filters={[{ key: "type", label: t.common.type, options: [{ value: "income", label: t.finance.income }, { value: "expense", label: t.finance.expenses }] }]}
                columns={[
                  { key: "date", label: t.common.date, kind: "date" },
                  { key: "description", label: t.common.description, primary: true },
                  { key: "category", label: t.common.category },
                  { key: "project", label: t.common.project, hideOnMobile: true },
                  { key: "amount", label: t.common.amount, kind: "money", render: (r) => <span className={r.type === "income" ? "text-emerald-700" : "text-red-700"}>{r.type === "income" ? "+" : "−"}{money(r.amount)}</span> },
                ]} />
            </div>
          </Section>
        </div>
      )}

      {tab === "cash" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {d.accounts.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  {a.kind === "bank" ? <Landmark className="h-4 w-4" /> : a.kind === "cash" ? <Wallet className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  <span className="truncate text-xs font-medium uppercase tracking-wide">{a.name}</span>
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{money(a.balance)}</p>
                <p className="text-xs text-slate-500">{a.bank} {a.number !== "—" ? `· ${a.number}` : ""}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label={t.overview.cash} value={money(sum(d.accounts.filter((a) => a.kind !== "bank").map((a) => a.balance)))} icon={<Wallet className="h-4 w-4" />} demo />
            <StatCard label={t.overview.bank} value={money(sum(d.accounts.filter((a) => a.kind === "bank").map((a) => a.balance)))} icon={<Landmark className="h-4 w-4" />} demo />
          </div>
          <Section title={t.finance.closing} demo><LineChartCard money area data={d.cashflow} x="month" series={[{ key: "closing", label: t.finance.closing, color: "#0f172a" }]} /></Section>
        </div>
      )}

      {(tab === "ar" || tab === "ap") && (() => {
        const rows = tab === "ar" ? arRows : apRows;
        const totals = { current: sum(rows.map((r) => r.current)), d30: sum(rows.map((r) => r.d30)), d60: sum(rows.map((r) => r.d60)), d90: sum(rows.map((r) => r.d90)) };
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label={t.finance.totalOwed} value={money(sum(Object.values(totals)))} tone={tab === "ar" ? "amber" : "blue"} icon={<Banknote className="h-4 w-4" />} demo />
              <StatCard label={t.finance.current} value={money(totals.current)} />
              <StatCard label={t.finance.d30} value={money(totals.d30)} />
              <StatCard label={t.finance.d60} value={money(totals.d60)} tone="amber" />
              <StatCard label={t.finance.d90} value={money(totals.d90)} tone="red" />
            </div>
            <Section title={t.finance.aging} demo flush>
              <div className="p-4">
                <DataTable rows={rows as Array<Record<string, unknown> & { id: string }>} rowKey={(r) => r.id} exportName={tab === "ar" ? "receivable" : "payable"}
                  columns={[
                    tab === "ar"
                      ? { key: "client", label: t.common.client, primary: true, render: (r) => <><p className="font-medium">{r.client as string}</p><p className="text-xs text-slate-500">{r.project as string}</p></>, value: (r) => `${r.client} ${r.project}` }
                      : { key: "supplier", label: t.finance.supplier, primary: true },
                    { key: "current", label: t.finance.current, kind: "money" },
                    { key: "d30", label: t.finance.d30, kind: "money" },
                    { key: "d60", label: t.finance.d60, kind: "money" },
                    { key: "d90", label: t.finance.d90, kind: "money", render: (r) => <span className={(r.d90 as number) > 0 ? "font-semibold text-red-700" : ""}>{money(r.d90 as number)}</span> },
                    { key: "total", label: t.common.total, kind: "money" },
                    ...(tab === "ap" ? [{ key: "dueNext", label: t.finance.dueDate, kind: "date" as const }] : []),
                  ]} />
              </div>
            </Section>
          </div>
        );
      })()}

      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(["pending", "partially_paid", "overdue", "paid"] as const).map((s) => (
              <StatCard key={s} label={statusLabel(t, s)} value={invRows.filter((i) => i.status === s).length}
                hint={money(sum(invRows.filter((i) => i.status === s).map((i) => (s === "paid" ? i.amount : i.outstanding))))}
                tone={s === "overdue" ? "red" : s === "paid" ? "green" : s === "pending" ? "amber" : "blue"} demo />
            ))}
          </div>
          <DataTable rows={invRows} rowKey={(r) => r.id} exportName="invoices"
            filters={[
              { key: "status", label: t.common.status, options: ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"].map((s) => ({ value: s, label: statusLabel(t, s) })) },
              { key: "type", label: t.finance.invoiceType, options: ["deposit", "milestone", "extra"].map((s) => ({ value: s, label: s })) },
            ]}
            columns={[
              { key: "no", label: t.finance.invoiceNo, primary: true },
              { key: "client", label: t.common.client, render: (r) => <><p>{r.client}</p><p className="text-xs text-slate-500">{r.project}</p></>, value: (r) => `${r.client} ${r.project}` },
              { key: "type", label: t.finance.invoiceType },
              { key: "due", label: t.finance.dueDate, kind: "date" },
              { key: "amount", label: t.common.amount, kind: "money" },
              { key: "outstanding", label: t.finance.outstanding, kind: "money" },
              { key: "status", label: t.common.status, kind: "status" },
            ]} />
        </div>
      )}

      {tab === "payments" && (
        <DataTable rows={d.payments} rowKey={(r) => r.id} exportName="payments"
          filters={[{ key: "method", label: t.common.method, options: methodOptions }, { key: "status", label: t.common.status, options: ["pending", "confirmed", "cancelled"].map((s) => ({ value: s, label: statusLabel(t, s) })) }]}
          columns={[
            { key: "date", label: t.common.date, kind: "date" },
            { key: "ref", label: t.common.reference, primary: true },
            { key: "client", label: t.common.client },
            { key: "project", label: t.common.project, hideOnMobile: true },
            { key: "method", label: t.common.method },
            { key: "amount", label: t.common.amount, kind: "money" },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}

      {tab === "receipts" && (
        <DataTable rows={d.receipts} rowKey={(r) => r.id} exportName="receipts"
          columns={[
            { key: "no", label: t.finance.receiptNo, primary: true },
            { key: "date", label: t.common.date, kind: "date" },
            { key: "client", label: t.common.client },
            { key: "method", label: t.common.method },
            { key: "payment", label: t.common.reference },
            { key: "amount", label: t.common.amount, kind: "money" },
          ]} />
      )}

      {tab === "pl" && (
        <Section title={t.finance.tabPl} demo>
          <table className="w-full max-w-2xl text-sm">
            <tbody>
              {([
                [t.finance.revenue, d.pl.revenue, rev],
                [t.finance.costOfWork, d.pl.costOfWork, cow],
              ] as const).map(([title, lines, total]) => (
                <PlBlock key={title} title={title} lines={lines} total={total} money={money} />
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold"><td className="py-2">{t.finance.grossProfit}</td><td className="py-2 text-right tabular-nums">{money(rev - cow)}</td></tr>
              <PlBlock title={t.finance.operating} lines={d.pl.operating} total={opx} money={money} />
              <tr className="border-t-2 border-slate-900 text-base font-bold">
                <td className="py-3">{t.finance.netProfit}</td>
                <td className={cn("py-3 text-right tabular-nums", rev - cow - opx >= 0 ? "text-emerald-700" : "text-red-700")}>{money(rev - cow - opx)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {tab === "cashflow" && (
        <div className="space-y-4">
          <Section title={t.finance.tabCashflow} demo>
            <BarChartCard money data={d.cashflow} x="month" series={[{ key: "inflow", label: t.finance.inflow, color: "#0d9488" }, { key: "outflow", label: t.finance.outflow, color: "#e11d48" }]} />
          </Section>
          <DataTable rows={d.cashflow} rowKey={(r) => r.month} searchable={false} exportName="cash-flow" pageSize={12}
            columns={[
              { key: "month", label: t.common.period, primary: true },
              { key: "opening", label: t.finance.opening, kind: "money" },
              { key: "inflow", label: t.finance.inflow, kind: "money" },
              { key: "outflow", label: t.finance.outflow, kind: "money" },
              { key: "closing", label: t.finance.closing, kind: "money" },
            ]} />
        </div>
      )}
    </div>
  );
}

function PlBlock({ title, lines, total, money }: { title: string; lines: ReadonlyArray<{ label: string; amount: number }>; total: number; money: (n: number) => string }) {
  return (
    <>
      <tr><td colSpan={2} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</td></tr>
      {lines.map((l) => <tr key={l.label}><td className="py-1 pl-3 text-slate-700">{l.label}</td><td className="py-1 text-right tabular-nums text-slate-700">{money(l.amount)}</td></tr>)}
      <tr className="border-t border-slate-200 font-medium"><td className="py-1.5">{title}</td><td className="py-1.5 text-right tabular-nums">{money(total)}</td></tr>
    </>
  );
}
