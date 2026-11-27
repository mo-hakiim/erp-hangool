import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/i18n";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";

type Enrollment = { factorId: string; qr: string; secret: string };

/** TOTP enrollment: shows a QR code, then verifies the first code (session becomes aal2). */
export function MfaEnroll({ onDone, showIntro = true }: { onDone: () => void | Promise<void>; showIntro?: boolean }) {
  const { t } = useI18n();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Enroll exactly once per mount (React StrictMode runs effects twice in development).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      // Remove half-finished enrollments from earlier attempts.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Hangool ERP ${stamp}` });
      if (error || !data) return setError(error?.message ?? t.app.errorTitle);
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [t.app.errorTitle]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
    setBusy(false);
    if (error) { setError(t.auth.mfaWrongCode); setCode(""); return; }
    await onDone();
  }

  if (error && !enrollment) return <Alert tone="error">{error}</Alert>;
  if (!enrollment) return <Spinner />;

  return (
    <form onSubmit={submit} className="space-y-4">
      {showIntro && <p className="text-sm text-slate-600">{t.auth.mfaIntro}</p>}
      <p className="text-sm font-medium text-slate-800">{t.auth.mfaStep1}</p>
      <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-3">
        <img src={enrollment.qr} alt="QR code" className="h-44 w-44" />
      </div>
      <p className="text-xs text-slate-500">
        {t.auth.mfaManual} <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">{enrollment.secret}</code>
      </p>
      <p className="text-sm font-medium text-slate-800">{t.auth.mfaStep2}</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t.auth.mfaCode} htmlFor="mfa-code">
        <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
          className="text-center font-mono text-lg tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>{busy ? t.auth.mfaVerifying : t.auth.mfaVerify}</Button>
    </form>
  );
}
