import { forwardRef, useEffect, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { FlaskConical, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/format";
import { Badge, Card } from "./ui";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-neutral-200 bg-surface px-3 pr-8 text-sm text-neutral-900 shadow-sm transition-colors hover:border-neutral-300",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-100",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[88px] w-full rounded-xl border border-neutral-200 bg-surface px-3 py-2 shadow-sm text-sm text-neutral-900 placeholder:text-neutral-400",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...rest}
    />
  );
});

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-neutral-900/50" aria-label={t.app.close} onClick={onClose} />
      <div className={cn("relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-neutral-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={t.app.close}><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ key: T; label: string; count?: number }>; value: T; onChange: (k: T) => void }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full gap-1 border-b border-neutral-200" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={value === tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              value === tab.key ? "border-gold text-primary" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800",
            )}
          >
            {tab.label}
            {tab.count != null && <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600">{tab.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small marker on everything that still shows sample data. */
export function DemoBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span title={t.common.demoHint} className={cn("inline-flex items-center gap-1 rounded-full border border-dashed border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700", className)}>
      <FlaskConical className="h-3 w-3" aria-hidden /> {t.app.demoData}
    </span>
  );
}

export function LiveBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t.common.liveData}
    </span>
  );
}

const statusTone: Record<string, "slate" | "amber" | "green" | "red" | "blue" | "purple"> = {
  pending: "amber", waiting: "amber", submitted: "amber", draft: "slate", open: "amber", scheduled: "blue", new: "blue",
  approved: "green", paid: "green", confirmed: "green", done: "blue", verified: "green", completed: "green", delivered: "green",
  active: "green", signed: "green", resolved: "green", ok: "green", present: "green", available: "green", running: "blue",
  partially_paid: "blue", in_progress: "blue", sourcing: "blue", ordered: "blue", pm_approved: "blue", contacted: "blue",
  visiting: "purple", reserved: "purple", rented: "purple", design: "purple", boq: "purple", priced: "purple", planned: "slate",
  rejected: "red", overdue: "red", cancelled: "slate", lost: "red", damaged: "red", missing: "red", absent: "red", low: "red",
  skipped: "slate", sold: "slate", handed_over: "slate", on_hold: "amber", ended: "slate", closed: "slate", superseded: "slate",
  on_leave: "amber", left: "slate", no_show: "red", in: "green", out: "blue", adjust: "amber", inactive: "red", invited: "amber",
};

export function statusLabel(t: { status: Record<string, string> }, value: string) {
  return t.status[value] ?? value.replace(/_/g, " ");
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const { t } = useI18n();
  if (!value) return <span className="text-neutral-400">—</span>;
  return <Badge tone={statusTone[value] ?? "slate"}>{statusLabel(t, value)}</Badge>;
}

export function StatCard({ label, value, hint, icon, tone = "slate", demo, live, trend }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "slate" | "amber" | "green" | "red" | "blue"; demo?: boolean; live?: boolean; trend?: number;
}) {
  const ring = { slate: "bg-neutral-100 text-neutral-600", amber: "bg-amber-100 text-amber-700", green: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-700", blue: "bg-sky-100 text-sky-700" }[tone];
  return (
    <Card className="p-4 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
        {icon && <span className={cn("rounded-lg p-1.5", ring)}>{icon}</span>}
      </div>
      <p className="mt-2 truncate font-display text-2xl font-bold tabular-nums text-neutral-900">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        {trend != null && (
          <span className={cn("font-medium", trend >= 0 ? "text-emerald-600" : "text-red-600")}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>
        )}
        {hint}
        {demo && <DemoBadge />}
        {live && <LiveBadge />}
      </div>
    </Card>
  );
}

export function Section({ title, actions, children, demo, live, className, flush }: {
  title: string; actions?: ReactNode; children: ReactNode; demo?: boolean; live?: boolean; className?: string; flush?: boolean;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-sm font-semibold text-neutral-900">{title}</h2>
          {demo && <DemoBadge />}
          {live && <LiveBadge />}
        </div>
        {actions}
      </div>
      <div className={cn("min-w-0 flex-1", !flush && "p-4")}>{children}</div>
    </Card>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "green" | "red" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const bar = { brand: "bg-gold", green: "bg-emerald-500", red: "bg-red-500" }[tone];
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[60px] overflow-hidden rounded-full bg-neutral-100"><div className={cn("h-full rounded-full", bar)} style={{ width: `${v}%` }} /></div>
      <span className="w-9 text-right text-xs tabular-nums text-neutral-600">{v}%</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-neutral-300")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

/** Definition list used on detail panels. */
export function InfoGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-neutral-900">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
