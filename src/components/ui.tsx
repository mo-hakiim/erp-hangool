import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg shadow-sm hover:bg-primary-dark hover:shadow-card disabled:bg-neutral-300 disabled:text-neutral-600 disabled:shadow-none",
  secondary: "border border-neutral-200 bg-surface text-neutral-800 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400",
  ghost: "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: "sm" | "md" }>(
  function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-neutral-200 bg-surface px-3 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 transition-colors",
        "hover:border-neutral-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-100",
        className,
      )}
      {...rest}
    />
  );
});

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-neutral-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    info: "bg-primary-soft/50 text-primary border-primary-soft",
    error: "bg-red-50 text-red-900 border-red-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
  }[tone];
  const Icon = tone === "error" || tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-xl border p-3 text-sm", styles)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-neutral-200/80 bg-surface shadow-card", className)}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /> {label}
    </div>
  );
}

export function Badge({ tone = "slate", children, className }: { tone?: "slate" | "amber" | "green" | "red" | "blue" | "purple"; children: ReactNode; className?: string }) {
  // Status colors stay clear and conventional: green = approved/paid, amber = pending, red = rejected/overdue.
  const styles = {
    slate: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    red: "bg-red-50 text-red-800 ring-red-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
    purple: "bg-violet-50 text-violet-800 ring-violet-200",
  }[tone];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", styles, className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-neutral-200/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 h-1 w-10 rounded-full bg-gold" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft/60 text-primary [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
      <p className="font-display font-semibold text-neutral-800">{title}</p>
      {body && <p className="max-w-sm text-sm text-neutral-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
