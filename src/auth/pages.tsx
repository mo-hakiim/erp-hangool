import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { isolatedClient, supabase } from "@/lib/supabase";
import { passwordStrongEnough } from "@/lib/format";
import { useI18n } from "@/i18n";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";
import { homePathFor, useAuth } from "./AuthProvider";
import { MfaEnroll } from "./MfaEnroll";

// ---------------------------------------------------------------- sign in

export function LoginPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === "ready") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : homePathFor(auth.roles)} replace />;
  }
  if (auth.status === "needsMfa") return <Navigate to="/mfa" replace />;
  if (auth.status === "needsMfaSetup") return <Navigate to="/mfa/setup" replace />;

  const blockedMsg = auth.blocked === "inactive" ? t.auth.inactive : auth.blocked === "noRoles" ? t.auth.noRoles : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(t.auth.invalid);
  }

  return (
    <AuthLayout title={t.auth.signInTitle} subtitle={t.auth.signInSubtitle}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {(error || blockedMsg) && <Alert tone="error">{error ?? blockedMsg}</Alert>}
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t.auth.password} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          {busy ? t.auth.signingIn : t.auth.signIn}
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-700 hover:underline">{t.auth.forgot}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------- forgot password

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Always show the same message, whether or not the email exists.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthLayout title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success">{t.auth.linkSent}</Alert>
          <Link to="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">{t.auth.backToSignIn}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.auth.email} htmlFor="email">
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>{busy ? t.auth.sending : t.auth.sendLink}</Button>
          <Link to="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">{t.auth.backToSignIn}</Link>
        </form>
      )}
    </AuthLayout>
  );
}

// ---------------------------------------------------------------- reset password (from the email link)

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState<"wait" | "ok" | "missing">("wait");

  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) { done = true; setReady("ok"); }
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) { done = true; setReady("ok"); } });
    const timer = setTimeout(() => { if (!done) setReady("missing"); }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  return (
    <AuthLayout title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      {ready === "wait" && <Spinner />}
      {ready === "missing" && (
        <div className="space-y-4">
          <Alert tone="error">{t.auth.resetMissing}</Alert>
          <Link to="/forgot-password" className="block text-center text-sm font-medium text-brand-700 hover:underline">{t.auth.forgotTitle}</Link>
        </div>
      )}
      {ready === "ok" && <NewPasswordForm onDone={() => navigate("/", { replace: true })} />}
    </AuthLayout>
  );
}

/** New password + repeat. If `email` is given, the current password is checked first. */
export function NewPasswordForm({ onDone, email }: { onDone?: () => void; email?: string }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!passwordStrongEnough(pw)) return setError(t.auth.passwordWeak);
    if (pw !== pw2) return setError(t.auth.passwordMismatch);
    setBusy(true);
    if (email) {
      const check = await isolatedClient().auth.signInWithPassword({ email, password: current });
      if (check.error) { setBusy(false); return setError(t.auth.currentWrong); }
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(true);
    setCurrent(""); setPw(""); setPw2("");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">{t.auth.passwordSaved}</Alert>}
      {email && (
        <Field label={t.auth.currentPassword} htmlFor="current-password">
          <Input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
      )}
      <Field label={t.auth.newPassword} htmlFor="new-password" hint={t.auth.passwordRules}>
        <Input id="new-password" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirm-password">
        <Input id="confirm-password" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <Button type="submit" loading={busy} className="w-full sm:w-auto">{busy ? t.app.saving : t.auth.savePassword}</Button>
    </form>
  );
}

// ---------------------------------------------------------------- 2FA challenge (after password)

export function MfaChallengePage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === "signedOut") return <Navigate to="/login" replace />;
  if (auth.status === "ready") return <Navigate to={homePathFor(auth.roles)} replace />;
  if (auth.status === "loading") return <Spinner />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!auth.totpFactor) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: auth.totpFactor.id, code: code.trim() });
    setBusy(false);
    if (error) { setError(t.auth.mfaWrongCode); setCode(""); return; }
    await auth.refresh();
  }

  return (
    <AuthLayout title={t.auth.mfaChallengeTitle} subtitle={t.auth.mfaChallengeSubtitle}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label={t.auth.mfaCode} htmlFor="code">
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
            className="text-center font-mono text-lg tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>{busy ? t.auth.mfaVerifying : t.auth.mfaVerify}</Button>
        <button type="button" onClick={() => auth.signOut()} className="block w-full text-center text-sm font-medium text-slate-600 hover:underline">{t.auth.signOut}</button>
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------- forced 2FA setup (company requires it)

export function MfaSetupPage() {
  const { t } = useI18n();
  const auth = useAuth();
  if (auth.status === "signedOut") return <Navigate to="/login" replace />;
  if (auth.status === "needsMfa") return <Navigate to="/mfa" replace />;
  if (auth.status === "loading") return <Spinner />;
  return (
    <AuthLayout title={t.auth.mfaTitle} subtitle={t.auth.mfaRequired}>
      <MfaEnroll onDone={() => auth.refresh()} />
      <button type="button" onClick={() => auth.signOut()} className="mt-6 block w-full text-center text-sm font-medium text-slate-600 hover:underline">{t.auth.signOut}</button>
    </AuthLayout>
  );
}
