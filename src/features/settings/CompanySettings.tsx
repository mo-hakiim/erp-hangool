import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/i18n";

export type CompanyInfo = { name: string; phone: string; email: string; address: string; tax_id: string; logo_url: string | null };
export type CompanySettings = {
  company: CompanyInfo;
  currency: { code: string; symbol: string };
  threshold: number;
  require2fa: boolean;
  stageNames: string[];
};

const defaults: CompanySettings = {
  company: { name: "Hangool Construction", phone: "", email: "", address: "", tax_id: "", logo_url: null },
  currency: { code: "USD", symbol: "$" },
  threshold: 5000,
  require2fa: false,
  stageNames: ["foundation", "columns", "walls", "roof", "finishing"],
};

export function parseSettings(rows: Array<{ key: string; value: unknown }>): CompanySettings {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    company: { ...defaults.company, ...((m.get("company") as Partial<CompanyInfo>) ?? {}) },
    currency: { ...defaults.currency, ...((m.get("currency") as Partial<CompanySettings["currency"]>) ?? {}) },
    threshold: Number(m.get("payment_two_approval_threshold") ?? defaults.threshold),
    require2fa: m.get("require_staff_2fa") === true,
    stageNames: Array.isArray(m.get("default_stage_names")) ? (m.get("default_stage_names") as string[]) : defaults.stageNames,
  };
}

type Ctx = { settings: CompanySettings; reload: () => Promise<void>; money: (n: number | null | undefined, opts?: { compact?: boolean }) => string };
const SettingsContext = createContext<Ctx | null>(null);

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [settings, setSettings] = useState<CompanySettings>(defaults);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("settings").select("key, value");
    if (data) setSettings(parseSettings(data));
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const money = useCallback((n: number | null | undefined, opts?: { compact?: boolean }) => {
    if (n == null || Number.isNaN(n)) return "—";
    const code = settings.currency.code;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency", currency: code, currencyDisplay: "narrowSymbol", maximumFractionDigits: opts?.compact ? 1 : 0,
        notation: opts?.compact ? "compact" : "standard",
      }).format(n);
    } catch {
      return `${settings.currency.symbol}${Math.round(n).toLocaleString(locale)}`;
    }
  }, [settings.currency, locale]);

  const value = useMemo(() => ({ settings, reload, money }), [settings, reload, money]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanySettingsProvider");
  return ctx;
}
