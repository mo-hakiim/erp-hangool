import type { ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { homePathFor, useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { Spinner } from "@/components/ui";
import type { Access } from "./nav";

/** Signed in, 2FA passed (if set up), and 2FA set up if the company requires it. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  const { t } = useI18n();
  if (auth.status === "loading") return <div className="min-h-dvh"><Spinner label={t.app.loading} /></div>;
  if (auth.status === "signedOut") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (auth.status === "needsMfa") return <Navigate to="/mfa" replace />;
  if (auth.status === "needsMfaSetup") return <Navigate to="/mfa/setup" replace />;
  return <Outlet />;
}

/** Page-level role guard: shows "You don't have access" instead of the page. */
export function Guard({ allow, children }: { allow: Access; children: ReactNode }) {
  const auth = useAuth();
  return allow(auth) ? <>{children}</> : <NoAccess />;
}

export function NoAccess() {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 rounded-full bg-red-50 p-4 text-red-600"><ShieldOff className="h-8 w-8" aria-hidden /></div>
      <h1 className="text-xl font-semibold text-neutral-900">{t.guard.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t.guard.body}</p>
      <Link to={homePathFor(auth.roles)} className="mt-6 text-sm font-medium text-primary hover:underline">{t.guard.goHome}</Link>
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-semibold text-neutral-300">404</p>
      <h1 className="mt-4 text-xl font-semibold text-neutral-900">{t.guard.notFoundTitle}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t.guard.notFoundBody}</p>
      <Link to={homePathFor(auth.roles)} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">{t.guard.goHome}</Link>
    </div>
  );
}

export function HomeRedirect() {
  const auth = useAuth();
  return <Navigate to={homePathFor(auth.roles)} replace />;
}
