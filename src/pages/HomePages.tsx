import { Link } from "react-router-dom";
import { Bell, Construction, UserCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { fmt, useI18n } from "@/i18n";
import { Badge, Card, PageHeader } from "@/components/ui";
import { useNotifications } from "@/features/notifications/NotificationsProvider";
import type { Dictionary } from "@/i18n/en";

function Welcome({ intro }: { intro: string }) {
  const { t } = useI18n();
  const auth = useAuth();
  const { unread } = useNotifications();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={fmt(t.home.welcome, { name: auth.profile?.full_name?.split(" ")[0] ?? "" })} />
      <div className="mb-6 flex flex-wrap gap-1.5">{auth.roles.map((r) => <Badge key={r} tone="amber">{t.roles[r]}</Badge>)}</div>
      <Card className="flex items-start gap-4 p-5">
        <Construction className="h-8 w-8 shrink-0 text-brand-500" aria-hidden />
        <p className="text-sm text-slate-600">{intro}</p>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link to="/notifications"><Card className="flex items-center gap-3 p-5 hover:border-brand-300">
          <Bell className="h-6 w-6 text-slate-500" /><span className="flex-1 font-medium text-slate-900">{t.nav.notifications}</span>
          {unread > 0 && <Badge tone="red">{unread}</Badge>}
        </Card></Link>
        <Link to="/account"><Card className="flex items-center gap-3 p-5 hover:border-brand-300">
          <UserCircle className="h-6 w-6 text-slate-500" /><span className="font-medium text-slate-900">{t.nav.account}</span>
        </Card></Link>
      </div>
    </div>
  );
}

export function StaffHomePage() {
  const { t } = useI18n();
  return <Welcome intro={t.home.staffIntro} />;
}

export function ClientHomePage() {
  const { t } = useI18n();
  return <Welcome intro={t.home.clientIntro} />;
}

/** Temporary owner screen until stage 3 replaces it. */
export function OwnerPlaceholder({ titleKey }: { titleKey: keyof Dictionary["nav"] }) {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t.nav[titleKey]} />
      <Card className="flex items-start gap-4 p-5">
        <Construction className="h-8 w-8 shrink-0 text-brand-500" aria-hidden />
        <p className="text-sm text-slate-600">{t.app.comingSoon}</p>
      </Card>
    </div>
  );
}
