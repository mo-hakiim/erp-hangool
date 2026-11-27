import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, HardHat, CheckSquare, Wallet, Users, ShoppingCart, Boxes, UserCheck, Building2,
  Megaphone, BarChart3, FileText, Bell, ShieldCheck, ScrollText, Settings, Home, UserCircle,
} from "lucide-react";
import type { AuthContextValue } from "@/auth/AuthProvider";
import type { Dictionary } from "@/i18n/en";

/** Who may open a page. Used by the sidebar (hide) and the route guard (block). */
export type Access = (a: AuthContextValue) => boolean;

const management: Access = (a) => a.hasRole("owner", "general_manager");
export const access = {
  everyone: (() => true) as Access,
  staff: ((a) => a.isStaff) as Access,
  management,
  ownerOnly: ((a) => a.hasRole("owner")) as Access,
  audit: ((a) => a.hasRole("owner", "general_manager") && a.can("audit")) as Access,
  nonManagementStaff: ((a) => a.isStaff && !a.hasRole("owner", "general_manager")) as Access,
  clientOnly: ((a) => a.isClient && !a.isStaff) as Access,
};

export type NavItem = {
  key: keyof Dictionary["nav"];
  path: string;
  icon: LucideIcon;
  allow: Access;
  group: "main" | "business" | "admin";
};

export const navItems: NavItem[] = [
  // Owner / CEO portal (owner + general manager)
  { key: "overview", path: "/owner", icon: LayoutDashboard, allow: management, group: "main" },
  { key: "projects", path: "/owner/projects", icon: HardHat, allow: management, group: "main" },
  { key: "approvals", path: "/owner/approvals", icon: CheckSquare, allow: management, group: "main" },
  { key: "finance", path: "/owner/finance", icon: Wallet, allow: management, group: "business" },
  { key: "clients", path: "/owner/clients", icon: Users, allow: management, group: "business" },
  { key: "procurement", path: "/owner/procurement", icon: ShoppingCart, allow: management, group: "business" },
  { key: "inventory", path: "/owner/inventory", icon: Boxes, allow: management, group: "business" },
  { key: "hr", path: "/owner/hr", icon: UserCheck, allow: management, group: "business" },
  { key: "realEstate", path: "/owner/real-estate", icon: Building2, allow: management, group: "business" },
  { key: "marketing", path: "/owner/marketing", icon: Megaphone, allow: management, group: "business" },
  { key: "reports", path: "/owner/reports", icon: BarChart3, allow: management, group: "business" },
  { key: "documents", path: "/owner/documents", icon: FileText, allow: management, group: "business" },
  { key: "staff", path: "/owner/staff", icon: ShieldCheck, allow: access.ownerOnly, group: "admin" },
  { key: "audit", path: "/owner/audit", icon: ScrollText, allow: access.audit, group: "admin" },
  { key: "settings", path: "/owner/settings", icon: Settings, allow: access.ownerOnly, group: "admin" },
  // Other staff and clients (their full portals come in later phases)
  { key: "home", path: "/home", icon: Home, allow: access.nonManagementStaff, group: "main" },
  { key: "home", path: "/client", icon: Home, allow: access.clientOnly, group: "main" },
  // Everyone
  { key: "notifications", path: "/notifications", icon: Bell, allow: access.everyone, group: "main" },
  { key: "account", path: "/account", icon: UserCircle, allow: access.everyone, group: "admin" },
];

export function visibleNav(a: AuthContextValue) {
  return navItems.filter((i) => i.allow(a));
}
