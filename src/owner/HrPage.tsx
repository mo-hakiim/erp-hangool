import { useState } from "react";
import { MapPin, UserCheck, Users, Wallet } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCompany } from "@/features/settings/CompanySettings";
import { PageHeader } from "@/components/ui";
import { DemoBadge, Section, StatCard, Tabs, statusLabel } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { BarChartCard, DonutChartCard } from "@/components/charts";
import { hrDemo as d } from "@/demo/ownerDemo";

type Tab = "employees" | "attendance" | "labour" | "leave" | "payroll";

export function HrPage() {
  const { t, locale } = useI18n();
  const { money } = useCompany();
  const [tab, setTab] = useState<Tab>("attendance");
  const time = (v: string | null) => (v ? new Date(v).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—");
  const present = d.attendance.filter((a) => a.status === "present").length;
  const payrollTotal = d.payroll.reduce((s, p) => s + p.net, 0);
  const byDept = Object.entries(d.employees.reduce<Record<string, number>>((a, e) => ({ ...a, [e.department]: (a[e.department] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader title={t.hr.title} subtitle={t.hr.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.hr.headcount} value={d.employees.length} icon={<Users className="h-4 w-4" />} demo />
        <StatCard label={t.overview.attendanceToday} value={`${present} / ${d.attendance.length}`} icon={<UserCheck className="h-4 w-4" />} tone="green" />
        <StatCard label={t.hr.labourToday} value={d.attendance.filter((a) => a.kind === "labourer" && a.status === "present").length} tone="blue" />
        <StatCard label={t.hr.payrollTotal} value={money(payrollTotal)} icon={<Wallet className="h-4 w-4" />} tone="amber" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "attendance", label: t.hr.tabAttendance }, { key: "employees", label: t.hr.tabEmployees, count: d.employees.length },
        { key: "labour", label: t.hr.tabLabour, count: d.labourers.length }, { key: "leave", label: t.hr.tabLeave, count: d.leave.filter((l) => l.status === "pending").length },
        { key: "payroll", label: t.hr.tabPayroll },
      ]} />

      {tab === "attendance" && (
        <DataTable rows={d.attendance} rowKey={(r) => r.id} exportName="attendance-today"
          filters={[{ key: "status", label: t.common.status, options: ["present", "absent", "on_leave"].map((s) => ({ value: s, label: statusLabel(t, s) })) }]}
          columns={[
            { key: "name", label: t.hr.person, primary: true, render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.kind === "labourer" ? t.hr.tabLabour : t.hr.tabEmployees}</p></>, value: (r) => r.name },
            { key: "project", label: t.common.project },
            { key: "checkIn", label: t.hr.checkIn, render: (r) => time(r.checkIn), value: (r) => r.checkIn },
            { key: "checkOut", label: t.hr.checkOut, render: (r) => time(r.checkOut), value: (r) => r.checkOut },
            { key: "gps", label: t.hr.gps, render: (r) => r.lat != null ? (
              <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=18/${r.lat}/${r.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                <MapPin className="h-3.5 w-3.5" />{r.lat.toFixed(4)}, {r.lng!.toFixed(4)}
              </a>) : "—", value: (r) => (r.lat != null ? `${r.lat}, ${r.lng}` : "") },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "employees" && (
        <div className="space-y-4">
          <Section title={t.hr.department} demo><DonutChartCard height={170} data={byDept} /></Section>
          <DataTable rows={d.employees} rowKey={(r) => r.id} exportName="employees"
            filters={[{ key: "department", label: t.hr.department, options: [...new Set(d.employees.map((e) => e.department))].map((x) => ({ value: x, label: x })) }]}
            columns={[
              { key: "no", label: "#", hideOnMobile: true },
              { key: "name", label: t.common.name, primary: true },
              { key: "job", label: t.hr.jobTitle },
              { key: "department", label: t.hr.department },
              { key: "hired", label: t.hr.hireDate, kind: "date", hideOnMobile: true },
              { key: "salary", label: t.hr.salary, kind: "money" },
              { key: "status", label: t.common.status, kind: "status" },
            ]} />
        </div>
      )}
      {tab === "labour" && (
        <DataTable rows={d.labourers.map((l) => ({ ...l, owed: l.dailyRate * l.daysWorked }))} rowKey={(r) => r.id} exportName="labourers"
          columns={[
            { key: "name", label: t.common.name, primary: true },
            { key: "trade", label: t.hr.trade },
            { key: "project", label: t.common.project },
            { key: "dailyRate", label: t.hr.dailyRate, kind: "money" },
            { key: "daysWorked", label: t.hr.daysWorked, kind: "number" },
            { key: "owed", label: t.hr.owed, kind: "money" },
          ]} />
      )}
      {tab === "leave" && (
        <DataTable rows={d.leave} rowKey={(r) => r.id} exportName="leave"
          filters={[{ key: "status", label: t.common.status, options: ["pending", "approved", "rejected"].map((s) => ({ value: s, label: statusLabel(t, s) })) }]}
          columns={[
            { key: "name", label: t.hr.person, primary: true },
            { key: "type", label: t.hr.leaveType },
            { key: "start", label: t.common.start, kind: "date" },
            { key: "end", label: t.common.end, kind: "date" },
            { key: "days", label: t.common.days, kind: "number" },
            { key: "reason", label: t.common.notes, hideOnMobile: true },
            { key: "status", label: t.common.status, kind: "status" },
          ]} />
      )}
      {tab === "payroll" && (
        <div className="space-y-4">
          <Section title={t.hr.tabPayroll} demo>
            <BarChartCard money data={d.payroll.map((p) => ({ name: p.name.split(" ")[0]!, net: p.net, deductions: p.deductions }))} x="name"
              series={[{ key: "net", label: t.hr.net, color: "#0f172a" }, { key: "deductions", label: t.hr.deductions, color: "#e11d48" }]} stacked />
          </Section>
          <DataTable rows={d.payroll} rowKey={(r) => r.id} exportName="payroll"
            columns={[
              { key: "name", label: t.common.name, primary: true },
              { key: "gross", label: t.hr.gross, kind: "money" },
              { key: "allowances", label: t.hr.allowances, kind: "money" },
              { key: "deductions", label: t.hr.deductions, kind: "money" },
              { key: "net", label: t.hr.net, kind: "money" },
              { key: "status", label: t.common.status, kind: "status" },
            ]} />
        </div>
      )}
    </div>
  );
}
