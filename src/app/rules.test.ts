import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { so } from "@/i18n/so";
import { navItems } from "./nav";
import { homePathFor, type AuthContextValue, type RoleCode } from "@/auth/AuthProvider";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : keys(v, `${prefix}${k}.`)));
}

function fakeAuth(roles: RoleCode[], perms: string[] = []): AuthContextValue {
  return {
    status: "ready", session: null, profile: null, roles, permissions: perms.map((area) => ({ area, can_write: false, scope: "all" })),
    totpFactor: null, requireStaff2fa: false, blocked: null,
    isStaff: roles.some((r) => r !== "client"), isClient: roles.includes("client"),
    hasRole: (...c) => c.some((x) => roles.includes(x)),
    can: (a) => roles.includes("owner") || perms.includes(a),
    refresh: async () => {}, signOut: async () => {},
  };
}
const pathsFor = (a: AuthContextValue) => navItems.filter((i) => i.allow(a)).map((i) => i.path);

describe("translations", () => {
  it("Somali has exactly the same keys as English", () => {
    expect(keys(so).sort()).toEqual(keys(en).sort());
  });
  it("every menu item has a label", () => {
    for (const i of navItems) expect(en.nav[i.key]).toBeTruthy();
  });
});

describe("menu by role", () => {
  it("owner sees the whole owner portal including staff, audit and settings", () => {
    const p = pathsFor(fakeAuth(["owner"]));
    for (const x of ["/owner", "/owner/approvals", "/owner/staff", "/owner/audit", "/owner/settings", "/notifications"]) expect(p).toContain(x);
    expect(p).not.toContain("/home");
  });
  it("general manager sees the portal but not staff & roles or settings", () => {
    const p = pathsFor(fakeAuth(["general_manager"], ["audit"]));
    expect(p).toContain("/owner/finance");
    expect(p).toContain("/owner/audit");
    expect(p).not.toContain("/owner/staff");
    expect(p).not.toContain("/owner/settings");
  });
  it("other staff and clients see no owner screens", () => {
    for (const roles of [["finance"], ["site_engineer"], ["employee"], ["client"]] as RoleCode[][]) {
      const p = pathsFor(fakeAuth(roles));
      expect(p.filter((x) => x.startsWith("/owner"))).toEqual([]);
      expect(p).toContain("/notifications");
    }
    expect(pathsFor(fakeAuth(["client"]))).toContain("/client");
    expect(pathsFor(fakeAuth(["finance"]))).toContain("/home");
  });
  it("landing page follows the role", () => {
    expect(homePathFor(["owner"])).toBe("/owner");
    expect(homePathFor(["general_manager", "finance"])).toBe("/owner");
    expect(homePathFor(["client"])).toBe("/client");
    expect(homePathFor(["site_engineer"])).toBe("/home");
  });
});
