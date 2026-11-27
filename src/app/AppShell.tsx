import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldAlert, UserCircle, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/i18n";
import { cn, initials, timeAgo } from "@/lib/format";
import { NotificationsProvider, useNotifications } from "@/features/notifications/NotificationsProvider";
import { CompanySettingsProvider } from "@/features/settings/CompanySettings";
import { visibleNav, type NavItem } from "./nav";

export function AppShell() {
  const [open, setOpen] = useState(false);
  // Desktop sidebar collapsed to icons; remembered per browser (a convenience only).
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("hangool_nav_collapsed") === "1"; } catch { return false; }
  });
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("hangool_nav_collapsed", c ? "0" : "1"); } catch { /* private mode */ }
    return !c;
  });
  const { t } = useI18n();

  return (
    <NotificationsProvider><CompanySettingsProvider>
      <div className="min-h-dvh bg-neutral-50 lg:flex">
        {/* desktop sidebar */}
        <aside className={cn("hidden shrink-0 border-r border-neutral-200 bg-surface transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-64")}>
          <div className="sticky top-0 flex h-dvh flex-col"><Sidebar collapsed={collapsed} onToggle={toggle} /></div>
        </aside>
        {/* mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-neutral-900/40" aria-label={t.shell.closeMenu} onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-lift">
              <Sidebar onClose={() => setOpen(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setOpen(true)} />
          <MfaBanner />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </CompanySettingsProvider></NotificationsProvider>
  );
}

function Sidebar({ onClose, collapsed = false, onToggle }: { onClose?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const auth = useAuth();
  const { t } = useI18n();
  const { unread } = useNotifications();
  const items = visibleNav(auth);
  const groups: Array<{ key: NavItem["group"]; label: string }> = [
    { key: "main", label: t.nav.groupMain },
    { key: "business", label: t.nav.groupBusiness },
    { key: "admin", label: t.nav.groupAdmin },
  ];
  const portal = auth.hasRole("owner", "general_manager") ? t.shell.portalOwner : auth.isStaff ? t.shell.portalStaff : t.shell.portalClient;

  return (
    <>
      <div className={cn("flex h-20 items-center border-b border-neutral-100", collapsed ? "justify-center px-2" : "justify-between gap-3 px-5")}>
        <Link to="/" className="flex min-w-0 flex-col" aria-label={t.app.name}>
          <Logo variant={collapsed ? "icon" : "full"} className={collapsed ? "" : "h-10"} />
          {!collapsed && <span className="mt-1 pl-0.5 text-[11px] font-bold uppercase tracking-wider text-gold">{portal}</span>}
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label={t.shell.closeMenu}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className={cn("scroll-thin flex-1 space-y-5 overflow-y-auto pb-6 pt-4", collapsed ? "px-2" : "px-3")} aria-label={t.shell.menu}>
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g.key);
          if (list.length === 0) return null;
          return (
            <div key={g.key}>
              {collapsed
                ? <div className="mx-3 mb-2 border-t border-neutral-100" />
                : <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{g.label}</p>}
              <ul className="space-y-0.5">
                {list.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/owner"}
                      title={collapsed ? t.nav[item.key] : undefined}
                      className={({ isActive }) => cn(
                        "group relative flex items-center gap-3 rounded-xl py-2 text-sm font-semibold transition-colors",
                        collapsed ? "justify-center px-0" : "px-3",
                        isActive ? "bg-primary text-primary-fg shadow-card" : "text-neutral-600 hover:bg-primary-soft/60 hover:text-primary",
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && !collapsed && <span aria-hidden className="absolute -left-3 bottom-1.5 top-1.5 w-1 rounded-r-full bg-gold" />}
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-gold" : "text-neutral-400 group-hover:text-primary")} aria-hidden />
                          {!collapsed && <span className="flex-1 truncate">{t.nav[item.key]}</span>}
                          {item.key === "notifications" && unread > 0 && (collapsed
                            ? <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-600" />
                            : <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{unread}</span>)}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      {onToggle && (
        <div className="border-t border-neutral-100 p-3">
          <button onClick={onToggle}
            className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900", collapsed && "justify-center px-0")}
            aria-label={collapsed ? t.shell.expandMenu : t.shell.collapseMenu} title={collapsed ? t.shell.expandMenu : t.shell.collapseMenu}>
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" /> {t.shell.collapseMenu}</>}
          </button>
        </div>
      )}
    </>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200/80 bg-surface/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button onClick={onMenu} className="-ml-1 rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden" aria-label={t.shell.openMenu}>
        <Menu className="h-5 w-5" />
      </button>
      <Link to="/" className="flex items-center lg:hidden" aria-label={t.app.name}>
        <Logo className="h-8" />
      </Link>
      <div className="flex-1" />
      <NotificationBell />
      <UserMenu />
    </header>
  );
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handle); };
  }, [onOutside]);
  return ref;
}

function NotificationBell() {
  const { t } = useI18n();
  const { items, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const navigate = useNavigate();
  const latest = items.slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-neutral-600 hover:bg-neutral-100"
        aria-label={`${t.shell.notifications}${unread ? ` (${unread})` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-neutral-200 bg-surface shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">{t.shell.notifications}</p>
            {unread > 0 && (
              <button onClick={() => markRead()} className="text-xs font-medium text-primary hover:underline">{t.shell.markAllRead}</button>
            )}
          </div>
          {latest.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">{t.shell.noNotifications}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto">
              {latest.map((n) => (
                <li key={n.id}>
                  <button
                    className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-neutral-50", !n.read_at && "bg-gold-soft")}
                    onClick={() => {
                      if (!n.read_at) void markRead([n.id]);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-gold")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">{n.title}</span>
                      {n.body && <span className="line-clamp-2 block text-xs text-neutral-500">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-neutral-400">{timeAgo(n.created_at, t)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-neutral-100 px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-neutral-50">
            {t.shell.seeAll}
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { t } = useI18n();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const name = auth.profile?.full_name || auth.profile?.email || "";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-neutral-100" aria-expanded={open} aria-label={t.shell.myAccount}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-gold">{initials(name)}</span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-neutral-800 sm:block">{name}</span>
        <ChevronDown className="hidden h-4 w-4 text-neutral-500 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-neutral-200 bg-surface py-1 shadow-lift">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
            <p className="truncate text-xs text-neutral-500">{auth.profile?.email}</p>
            <p className="mt-1 text-xs text-neutral-500">{auth.roles.map((r) => t.roles[r]).join(", ")}</p>
          </div>
          <Link to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
            <UserCircle className="h-4 w-4" /> {t.shell.myAccount}
          </Link>
          <Link to="/account#security" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
            <KeyRound className="h-4 w-4" /> {t.auth.changePasswordTitle}
          </Link>
          <button onClick={() => auth.signOut()} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">
            <LogOut className="h-4 w-4" /> {t.auth.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

function MfaBanner() {
  const auth = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  if (!auth.isStaff || auth.totpFactor || location.pathname === "/account") return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-amber-900">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1">{t.auth.mfaBanner}</span>
        <Link to="/account#security" className="font-semibold underline">{t.auth.mfaBannerAction}</Link>
      </div>
    </div>
  );
}
