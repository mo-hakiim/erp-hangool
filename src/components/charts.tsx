import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useCompany } from "@/features/settings/CompanySettings";

// One restrained palette for all charts: ink, amber (brand), teal, sky, slate, rose.
export const chartColors = ["#0f172a", "#f59e0b", "#0d9488", "#0ea5e9", "#94a3b8", "#e11d48", "#8b5cf6"];

type Series = { key: string; label: string; color?: string };
type Row = Record<string, string | number>;

const axis = { stroke: "#94a3b8", fontSize: 12, tickLine: false, axisLine: false } as const;

function useTick(money?: boolean) {
  const { money: fmt } = useCompany();
  return money ? (v: number) => fmt(v, { compact: true }) : (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));
}

function MoneyTooltip({ money }: { money?: boolean }) {
  const { money: fmt } = useCompany();
  return (
    <Tooltip
      cursor={{ fill: "rgba(148,163,184,0.12)" }}
      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
      formatter={(v: number) => (money ? fmt(v) : v.toLocaleString())}
    />
  );
}

export function BarChartCard({ data, x, series, money, stacked, height = 260, horizontal }: {
  data: Row[]; x: string; series: Series[]; money?: boolean; stacked?: boolean; height?: number; horizontal?: boolean;
}) {
  const tick = useTick(money);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 8 : -8, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" {...axis} tickFormatter={tick} />
              <YAxis type="category" dataKey={x} {...axis} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} {...axis} />
              <YAxis {...axis} tickFormatter={tick} width={56} />
            </>
          )}
          <MoneyTooltip money={money} />
          {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? chartColors[i % chartColors.length]} radius={stacked ? 0 : [4, 4, 0, 0]} stackId={stacked ? "a" : undefined} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartCard({ data, x, series, money, height = 260, area }: { data: Row[]; x: string; series: Series[]; money?: boolean; height?: number; area?: boolean }) {
  const tick = useTick(money);
  const Chart = area ? AreaChart : LineChart;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={x} {...axis} />
          <YAxis {...axis} tickFormatter={tick} width={56} />
          <MoneyTooltip money={money} />
          {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => {
            const color = s.color ?? chartColors[i % chartColors.length];
            return area
              ? <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} />
              : <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={false} />;
          })}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChartCard({ data, money, height = 220 }: { data: Array<{ name: string; value: number; color?: string }>; money?: boolean; height?: number }) {
  const { money: fmt } = useCompany();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div style={{ height, width: height }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={d.name} fill={d.color ?? chartColors[i % chartColors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: number) => (money ? fmt(v) : v.toLocaleString())} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color ?? chartColors[i % chartColors.length] }} />
            <span className="flex-1 truncate text-slate-600">{d.name}</span>
            <span className="font-medium tabular-nums text-slate-900">{money ? fmt(d.value) : d.value.toLocaleString()}</span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
