import { fmt } from "@/i18n";
import type { Dictionary } from "@/i18n/en";

export function timeAgo(iso: string, t: Dictionary, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return t.time.justNow;
  if (s < 3600) return fmt(t.time.minutesAgo, { n: Math.floor(s / 60) });
  if (s < 86400) return fmt(t.time.hoursAgo, { n: Math.floor(s / 3600) });
  return fmt(t.time.daysAgo, { n: Math.floor(s / 86400) });
}

export function formatDate(iso: string | null | undefined, locale = "en-GB") {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function formatMoney(n: number | null | undefined, currency = "USD", locale = "en-GB") {
  if (n == null) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

/** Password policy shared by reset / change / invite screens. */
export function passwordStrongEnough(p: string) {
  return p.length >= 10 && /[a-z]/i.test(p) && /\d/.test(p);
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
