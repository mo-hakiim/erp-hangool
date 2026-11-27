import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en, type Dictionary } from "./en";
import { so } from "./so";

export type Lang = "en" | "so";
const dictionaries: Record<Lang, Dictionary> = { en, so };
const STORAGE_KEY = "hangool_lang";

function savedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "so" ? "so" : "en";
  } catch {
    return "en";
  }
}

/** Replace {name} placeholders. */
export function fmt(text: string, vars: Record<string, string | number> = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

type Ctx = { t: Dictionary; lang: Lang; setLang: (l: Lang) => void; locale: string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(savedLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* private mode */ }
    document.documentElement.lang = l;
  }, []);
  const value = useMemo(
    () => ({ t: dictionaries[lang], lang, setLang, locale: lang === "so" ? "so-SO" : "en-GB" }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
