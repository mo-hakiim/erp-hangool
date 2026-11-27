import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Factor, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type RoleCode =
  | "owner" | "general_manager" | "finance" | "accountant" | "hr" | "procurement" | "storekeeper"
  | "project_manager" | "site_engineer" | "site_supervisor" | "qs" | "architect" | "marketing"
  | "real_estate_officer" | "employee" | "client";

export type Profile = { id: string; full_name: string; email: string; phone: string | null; is_active: boolean };
export type Permission = { area: string; can_write: boolean; scope: "all" | "assigned" };

export type AuthStatus =
  | "loading"
  | "signedOut"
  | "needsMfa"        // has a verified TOTP factor, session is still aal1
  | "needsMfaSetup"   // staff, company requires 2FA, no factor yet
  | "ready";

export type BlockReason = "inactive" | "noRoles" | null;

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  roles: RoleCode[];
  permissions: Permission[];
  totpFactor: Factor | null;
  requireStaff2fa: boolean;
  blocked: BlockReason;
};

export type AuthContextValue = AuthState & {
  isStaff: boolean;
  isClient: boolean;
  hasRole: (...codes: RoleCode[]) => boolean;
  can: (area: string, write?: boolean) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const initial: AuthState = {
  status: "loading", session: null, profile: null, roles: [], permissions: [],
  totpFactor: null, requireStaff2fa: false, blocked: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadState(session: Session | null): Promise<AuthState> {
  if (!session) return { ...initial, status: "signedOut" };

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const totpFactor = factors?.totp?.find((f) => f.status === "verified") ?? null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, is_active").eq("id", session.user.id).maybeSingle(),
    supabase.rpc("my_roles"),
  ]);
  const roleList = ((roles as string[] | null) ?? []) as RoleCode[];

  if (profile && !profile.is_active) {
    return { ...initial, status: "signedOut", blocked: "inactive" };
  }
  if (roleList.length === 0) {
    return { ...initial, status: "signedOut", blocked: "noRoles" };
  }

  const base: AuthState = {
    ...initial, session, profile: (profile as Profile) ?? null, roles: roleList, totpFactor,
  };
  // Verified factor but this session has not passed the code yet: the database will refuse data until aal2.
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { ...base, status: "needsMfa" };
  }

  const isStaff = roleList.some((r) => r !== "client");
  const [{ data: perms }, { data: req }] = await Promise.all([
    supabase.rpc("my_permissions"),
    isStaff ? supabase.from("settings").select("value").eq("key", "require_staff_2fa").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const requireStaff2fa = req?.value === true;
  const state: AuthState = { ...base, permissions: (perms as Permission[] | null) ?? [], requireStaff2fa, status: "ready" };
  if (isStaff && requireStaff2fa && !totpFactor) state.status = "needsMfaSetup";
  return state;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initial);
  const seq = useRef(0);
  // Why the last sign-in was refused; kept across the sign-out that follows.
  const blockedRef = useRef<BlockReason>(null);

  const apply = useCallback(async (session: Session | null) => {
    const mine = ++seq.current;
    try {
      const next = await loadState(session);
      if (session && !next.blocked) blockedRef.current = null;
      if (next.blocked) {
        blockedRef.current = next.blocked;
        await supabase.auth.signOut();
      }
      if (!session) next.blocked = blockedRef.current;
      if (mine === seq.current) setState(next);
    } catch {
      if (mine === seq.current) setState({ ...initial, status: session ? "ready" : "signedOut", session });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside this callback; defer them.
      setTimeout(() => {
        if (event === "SIGNED_IN" && session) {
          void supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", session.user.id);
        }
        if (event === "TOKEN_REFRESHED") {
          setState((s) => ({ ...s, session }));
          return;
        }
        void apply(session);
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [apply]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await apply(data.session);
  }, [apply]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ ...initial, status: "signedOut" });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isOwner = state.roles.includes("owner");
    return {
      ...state,
      isStaff: state.roles.some((r) => r !== "client"),
      isClient: state.roles.includes("client"),
      hasRole: (...codes) => codes.some((c) => state.roles.includes(c)),
      can: (area, write = false) =>
        isOwner || state.permissions.some((p) => p.area === area && (!write || p.can_write)),
      refresh,
      signOut,
    };
  }, [state, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Where a person lands after signing in. */
export function homePathFor(roles: RoleCode[]) {
  if (roles.includes("owner") || roles.includes("general_manager")) return "/owner";
  if (roles.includes("client") && roles.length === 1) return "/client";
  return "/home";
}
