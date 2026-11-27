import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useCompany } from "@/features/settings/CompanySettings";

// One restrained palette for all charts: ink, amber (brand), teal, sky, slate, rose.
// Brand chart colors, read from the CSS variables in src/index.css (one place to change them).
export type BrandColor = "primary" | "gold" | "mid" | "muted" | "goldLight" | "danger" | "soft";
const cssVar: Record<BrandColor, string> = { primary: "--chart-1", gold: "--chart-2", mid: "--chart-3", muted: "--chart-4", goldLight: "--chart-5", danger: "--chart-6", soft: "--chart-soft" };
export function brandColor(name: BrandColor, alpha = 1) {
  const raw = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(cssVar[name]).trim();
  const [r, g, b] = (raw || "23 61 42").split(/\s+/);
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
export const chartColors = new Proxy([] as string[], { get: (_t, p) => {
  const order: BrandColor[] = ["primary", "gold", "mid", "muted", "goldLight", "danger"];
  if (p === "length") return order.length;
  const i = Number(p); return Number.isInteger(i) ? brandColor(order[i % order.length]!) : undefined;
} });

type Series = { key: string; label: string; color?: string };
type Row = Record<string, string | number>;

const axis = { stroke: "rgb(149, 153, 144)", fontSize: 12, tickLine: false, axisLine: false } as const;

function useTick(money?: boolean) {
  const { money: fmt } = useCompany();
  return money ? (v: number) => fmt(v, { compact: true }) : (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));
}

function MoneyTooltip({ money }: { money?: boolean }) {
  const { money: fmt } = useCompany();
  return (
    <Tooltip
      cursor={{ fill: "rgba(148,163,184,0.12)" }}
      contentStyle={{ borderRadius: 8, border: "1px solid rgb(222, 218, 206)", fontSize: 12 }}
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
          <CartesianGrid stroke="rgb(243, 239, 228)" vertical={horizontal} horizontal={!horizontal} />
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
          <CartesianGrid stroke="rgb(243, 239, 228)" vertical={false} />
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
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row">
      <div style={{ height, width: height }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={d.name} fill={d.color ?? chartColors[i % chartColors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid rgb(222, 218, 206)", fontSize: 12 }} formatter={(v: number) => (money ? fmt(v) : v.toLocaleString())} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color ?? chartColors[i % chartColors.length] }} />
            <span className="min-w-0 flex-1 truncate text-neutral-600" title={d.name}>{d.name}</span>
            <span className="font-medium tabular-nums text-neutral-900">{money ? fmt(d.value) : d.value.toLocaleString()}</span>
            <span className="w-10 text-right text-xs tabular-nums text-neutral-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
