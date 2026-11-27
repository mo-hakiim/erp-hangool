import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/i18n";
import { useCompany, type CompanySettings } from "@/features/settings/CompanySettings";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, Button, Field, Input, PageHeader } from "@/components/ui";
import { LiveBadge, Section, Select, Toggle } from "@/components/blocks";

const CURRENCIES = [
  { code: "USD", symbol: "$" }, { code: "SOS", symbol: "Sh" }, { code: "ETB", symbol: "Br" }, { code: "KES", symbol: "KSh" },
  { code: "AED", symbol: "AED" }, { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
];

export function SettingsPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const { settings, reload } = useCompany();
  const [s, setS] = useState<CompanySettings>(settings);
  const [stageText, setStageText] = useState(settings.stageNames.join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => { setS(settings); setStageText(settings.stageNames.join(", ")); }, [settings]);

  const setCompany = (k: keyof CompanySettings["company"]) => (e: { target: { value: string } }) => setS((x) => ({ ...x, company: { ...x.company, [k]: e.target.value } }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const names = stageText.split(",").map((x) => x.trim()).filter(Boolean);
    const before: Record<string, unknown> = {
      company: settings.company, currency: settings.currency, payment_two_approval_threshold: settings.threshold,
      require_staff_2fa: settings.require2fa, default_stage_names: settings.stageNames,
    };
    // Only write keys that changed, so the audit log stays meaningful.
    const rows = [
      { key: "company", value: s.company },
      { key: "currency", value: s.currency },
      { key: "payment_two_approval_threshold", value: Math.max(0, Number(s.threshold) || 0) },
      { key: "require_staff_2fa", value: s.require2fa },
      { key: "default_stage_names", value: names.length ? names : settings.stageNames },
    ].filter((r) => JSON.stringify(r.value) !== JSON.stringify(before[r.key]))
      .map((r) => ({ ...r, updated_by: auth.session?.user.id }));
    if (rows.length === 0) { setBusy(false); return setMsg({ tone: "success", text: t.settings.saved }); }
    const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: t.settings.saved });
    await reload();
    await auth.refresh();
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl">
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle}
        actions={<><LiveBadge /><Button type="submit" loading={busy}>{busy ? t.app.saving : t.app.save}</Button></>} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="space-y-4">
        <Section title={t.settings.company}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label={t.settings.companyName} htmlFor="c-name"><Input id="c-name" required value={s.company.name} onChange={setCompany("name")} /></Field></div>
            <Field label={t.common.phone} htmlFor="c-phone"><Input id="c-phone" type="tel" value={s.company.phone} onChange={setCompany("phone")} /></Field>
            <Field label={t.common.email} htmlFor="c-email"><Input id="c-email" type="email" value={s.company.email} onChange={setCompany("email")} /></Field>
            <Field label={t.settings.address} htmlFor="c-address"><Input id="c-address" value={s.company.address} onChange={setCompany("address")} /></Field>
            <Field label={t.settings.taxId} htmlFor="c-tax"><Input id="c-tax" value={s.company.tax_id} onChange={setCompany("tax_id")} /></Field>
          </div>
        </Section>
        <Section title={t.settings.approvals}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t.settings.threshold} (${s.currency.code})`} htmlFor="c-threshold" hint={t.settings.thresholdHint}>
              <Input id="c-threshold" type="number" min="0" step="1" required value={String(s.threshold)} onChange={(e) => setS((x) => ({ ...x, threshold: Number(e.target.value) }))} />
            </Field>
          </div>
        </Section>
        <Section title={t.settings.currency}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.settings.currencyCode} htmlFor="c-cur">
              <Select id="c-cur" value={s.currency.code} onChange={(e) => {
                const c = CURRENCIES.find((x) => x.code === e.target.value);
                setS((x) => ({ ...x, currency: c ?? { ...x.currency, code: e.target.value } }));
              }}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <Field label={t.settings.currencySymbol} htmlFor="c-sym">
              <Input id="c-sym" required maxLength={5} value={s.currency.symbol} onChange={(e) => setS((x) => ({ ...x, currency: { ...x.currency, symbol: e.target.value } }))} />
            </Field>
          </div>
        </Section>
        <Section title={t.settings.security}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="c-2fa" className="text-sm font-medium text-slate-900">{t.settings.require2fa}</label>
              <p className="mt-0.5 text-sm text-slate-500">{t.settings.require2faHint}</p>
            </div>
            <Toggle id="c-2fa" label={t.settings.require2fa} checked={s.require2fa} onChange={(v) => setS((x) => ({ ...x, require2fa: v }))} />
          </div>
        </Section>
        <Section title={t.settings.stages}>
          <Field label={t.settings.defaultStages} htmlFor="c-stages" hint={t.settings.defaultStagesHint}>
            <Input id="c-stages" value={stageText} onChange={(e) => setStageText(e.target.value)} />
          </Field>
        </Section>
      </div>
    </form>
  );
}
