import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { Logo } from "@/components/Logo";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-neutral-50 px-4 py-10 sm:px-6">
      {/* soft brand shapes in the background */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-soft/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-gold/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-gold to-primary" />

      <main className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="h-14 sm:h-16" />
        </div>
        <div className="rounded-2xl border border-neutral-200/80 bg-surface p-6 shadow-lift sm:p-8">
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-neutral-500">
          {t.app.name} · © {new Date().getFullYear()} {t.app.company}
        </p>
      </main>
    </div>
  );
}
