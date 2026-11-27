import type { ReactNode } from "react";
import { useI18n } from "@/i18n";

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0f172a" />
      <path d="M8 24V9h3.2v6h9.6V9H24v15h-3.2v-6h-9.6v6z" fill="#f59e0b" />
    </svg>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100 lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3 text-white">
          <BrandMark className="h-10 w-10" />
          <span className="text-lg font-semibold">{t.app.company}</span>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="text-3xl font-semibold leading-tight text-white">{t.app.name}</p>
          <p className="mt-3 text-slate-300">Projects · Finance · Procurement · HR · Real estate</p>
        </div>
        <svg className="absolute -bottom-10 -right-10 h-96 w-96 text-ink-800" viewBox="0 0 200 200" aria-hidden>
          <path fill="currentColor" d="M20 180h160v-8H20zM40 172V90h30v82zm40 0V50h40v122zm50 0v-60h30v60z" />
          <path stroke="#f59e0b" strokeWidth="3" fill="none" d="M100 50V18h60m-20 0v24" />
        </svg>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-lg font-semibold text-slate-900">{t.app.name}</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
