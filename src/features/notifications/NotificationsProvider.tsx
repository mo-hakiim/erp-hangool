import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";

export type Notification = {
  id: string; type: string; title: string; body: string | null; link: string | null;
  read_at: string | null; created_at: string;
};

type Ctx = {
  items: Notification[];      // newest first (latest 200)
  unread: number;
  loading: boolean;
  error: string | null;
  markRead: (ids?: string[]) => Promise<void>;
  reload: () => Promise<void>;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.session?.user.id;
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) return setError(error.message);
    setError(null);
    setItems((data ?? []) as Notification[]);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void reload();
    // Live: new rows arrive through Realtime (RLS applies). Poll as a fallback.
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void reload())
      .subscribe();
    const timer = window.setInterval(() => void reload(), 60_000);
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [userId, reload]);

  const markRead = useCallback(async (ids?: string[]) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n)));
    const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids ?? null });
    if (error) { setError(error.message); void reload(); }
  }, [reload]);

  const value = useMemo(
    () => ({ items, unread: items.filter((n) => !n.read_at).length, loading, error, markRead, reload }),
    [items, loading, error, markRead, reload],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
