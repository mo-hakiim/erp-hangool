import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { NewPasswordForm } from "@/auth/pages";
import { MfaEnroll } from "@/auth/MfaEnroll";
import { fmt, useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from "@/components/ui";

export function AccountPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#security") document.getElementById("security")?.scrollIntoView({ behavior: "smooth" });
  }, [location.hash]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.auth.accountTitle} />
      <div className="space-y-6">
        <ProfileCard />
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">{t.auth.changePasswordTitle}</h2>
          <div className="max-w-sm"><NewPasswordForm email={auth.profile?.email} /></div>
        </Card>
        <div id="security" className="scroll-mt-20">{auth.isStaff && <MfaCard />}</div>
      </div>
    </div>
  );
}

function ProfileCard() {
  const { t } = useI18n();
  const auth = useAuth();
  const [name, setName] = useState(auth.profile?.full_name ?? "");
  const [phone, setPhone] = useState(auth.profile?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!auth.profile) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim() || null }).eq("id", auth.profile.id);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: t.auth.profileSaved });
    await auth.refresh();
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-neutral-900">{t.auth.profile}</h2>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        <Field label={t.auth.fullName} htmlFor="full-name">
          <Input id="full-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label={t.auth.phone} htmlFor="phone">
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </Field>
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" value={auth.profile?.email ?? ""} disabled />
        </Field>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-neutral-700">{t.auth.roles}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {auth.roles.map((r) => <Badge key={r} tone="amber">{t.roles[r]}</Badge>)}
          </div>
        </div>
        <div className="sm:col-span-2"><Button type="submit" loading={busy}>{busy ? t.app.saving : t.app.save}</Button></div>
      </form>
    </Card>
  );
}

function MfaCard() {
  const { t, locale } = useI18n();
  const auth = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const factor = auth.totpFactor;

  async function remove() {
    if (!factor || !window.confirm(t.auth.mfaRemoveConfirm)) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (!error) await supabase.auth.refreshSession();
    setBusy(false);
    if (error) return setError(error.message);
    await auth.refresh();
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-1 text-base font-semibold text-neutral-900">{t.auth.mfaTitle}</h2>
      <p className="mb-4 text-sm text-neutral-600">{t.auth.mfaIntro}</p>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {factor ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{t.auth.mfaEnabled}</p>
              <p className="text-xs text-neutral-500">{fmt(t.auth.mfaEnabledSince, { date: formatDate(factor.created_at, locale) })}</p>
            </div>
          </div>
          {!auth.requireStaff2fa && (
            <Button variant="secondary" onClick={remove} loading={busy}>{t.auth.mfaRemove}</Button>
          )}
        </div>
      ) : enrolling ? (
        <div className="max-w-sm">
          <MfaEnroll showIntro={false} onDone={async () => { setEnrolling(false); await auth.refresh(); }} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldOff className="h-8 w-8 text-amber-500" />
            <p className="text-sm font-medium text-neutral-900">{t.auth.mfaOff}</p>
          </div>
          <Button onClick={() => setEnrolling(true)}>{t.auth.mfaStart}</Button>
        </div>
      )}
    </Card>
  );
}
