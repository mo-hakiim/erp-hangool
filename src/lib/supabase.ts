import { createClient } from "@supabase/supabase-js";

// Public values only. The anon / publishable key is safe in the browser; RLS protects the data.
// The service_role key must never appear in frontend code.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** A throwaway client that never stores a session — used to check a password without replacing the current login. */
export function isolatedClient() {
  return createClient(url ?? "http://localhost", anonKey ?? "missing", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "hangool-verify" },
  });
}
