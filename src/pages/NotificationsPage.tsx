import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellOff, CheckCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn, timeAgo, formatDate } from "@/lib/format";
import { useNotifications } from "@/features/notifications/NotificationsProvider";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";

const typeTone: Record<string, "amber" | "red" | "blue" | "green" | "purple" | "slate"> = {
  approval: "amber", alert: "red", finance: "green", project: "blue", info: "slate",
};

export function NotificationsPage() {
  const { t, locale } = useI18n();
  const { items, unread, loading, error, markRead } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();
  const list = filter === "unread" ? items.filter((n) => !n.read_at) : items;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.notifications.title}
        subtitle={t.notifications.subtitle}
        actions={unread > 0 && (
          <Button variant="secondary" onClick={() => markRead()}><CheckCheck className="h-4 w-4" /> {t.shell.markAllRead}</Button>
        )}
      />
      <div className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white p-1" role="tablist">
        {(["all", "unread"] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors", filter === f ? "bg-primary text-primary-fg shadow-sm" : "text-neutral-600 hover:bg-neutral-100")}>
            {f === "all" ? t.notifications.all : `${t.notifications.unread} (${unread})`}
          </button>
        ))}
      </div>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      <Card>
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState icon={<BellOff className="h-10 w-10" />} title={filter === "unread" ? t.notifications.emptyUnread : t.notifications.empty} />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {list.map((n) => (
              <li key={n.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-start", !n.read_at && "bg-gold-soft")}>
                <span className={cn("mt-1.5 hidden h-2 w-2 shrink-0 rounded-full sm:block", n.read_at ? "bg-neutral-200" : "bg-gold")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
                    <Badge tone={typeTone[n.type] ?? "slate"}>{n.type}</Badge>
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-neutral-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-neutral-400" title={formatDate(n.created_at, locale)}>{timeAgo(n.created_at, t)}</p>
                </div>
                <div className="flex gap-2">
                  {n.link && (
                    <Button size="sm" variant="secondary" onClick={() => { if (!n.read_at) void markRead([n.id]); navigate(n.link!); }}>
                      {t.notifications.open}
                    </Button>
                  )}
                  {!n.read_at && <Button size="sm" variant="ghost" onClick={() => markRead([n.id])}>{t.notifications.markRead}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
