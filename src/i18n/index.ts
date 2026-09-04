import { useCallback, useEffect, useSyncExternalStore } from "react";
import { en, type MsgKey } from "./en";
import { de } from "./de";
import { el } from "./el";
import { es } from "./es";
import { fr } from "./fr";
import { hi } from "./hi";
import { it } from "./it";
import { nb } from "./nb";
import { nl } from "./nl";
import { pl } from "./pl";
import { pt } from "./pt";
import { tr } from "./tr";
import { zh } from "./zh";
import { setDaysLeftFmt, setFormatLocale } from "../game/format";

export type Locale =
  | "en"
  | "nb"
  | "de"
  | "fr"
  | "nl"
  | "es"
  | "pt"
  | "it"
  | "pl"
  | "el"
  | "tr"
  | "zh"
  | "hi";
export type { MsgKey };

export const LOCALES: { id: Locale; native: string; html: string }[] = [
  { id: "en", native: "English", html: "en" },
  { id: "nb", native: "Norsk", html: "nb" },
  { id: "de", native: "Deutsch", html: "de" },
  { id: "fr", native: "Français", html: "fr" },
  { id: "nl", native: "Nederlands", html: "nl" },
  { id: "es", native: "Español", html: "es" },
  { id: "pt", native: "Português", html: "pt" },
  { id: "it", native: "Italiano", html: "it" },
  { id: "pl", native: "Polski", html: "pl" },
  { id: "el", native: "Ελληνικά", html: "el" },
  { id: "tr", native: "Türkçe", html: "tr" },
  { id: "zh", native: "中文", html: "zh-CN" },
  { id: "hi", native: "हिन्दी", html: "hi" },
];

const DICT: Record<Locale, Record<MsgKey, string>> = {
  en,
  nb,
  de,
  fr,
  nl,
  es,
  pt,
  it,
  pl,
  el,
  tr,
  zh,
  hi,
};
const KEY = "poc-locale";
const listeners = new Set<() => void>();
const LOCALE_SET = new Set<string>(LOCALES.map((l) => l.id));

const SSR_DEFAULT: Locale = "en";
let locale: Locale = SSR_DEFAULT;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && LOCALE_SET.has(v);
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("hi")) return "hi";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("nb") || nav.startsWith("nn") || nav.startsWith("no")) return "nb";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("nl")) return "nl";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("it")) return "it";
  if (nav.startsWith("pl")) return "pl";
  if (nav.startsWith("el")) return "el";
  if (nav.startsWith("tr")) return "tr";
  return "en";
}

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale) {
  locale = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  applySideEffects(next);
  listeners.forEach((l) => l());
}

function applySideEffects(l: Locale) {
  setFormatLocale(l);
  setDaysLeftFmt((d, n) => {
    if (d < -0.05) return t("fmt.daysLate", { n });
    if (d < 1) return t("fmt.dueToday");
    return t("fmt.daysLeft", { n });
  });
  if (typeof document !== "undefined") {
    const meta = LOCALES.find((x) => x.id === l);
    document.documentElement.lang = meta?.html ?? "en";
    document.documentElement.classList.toggle("font-cjk", l === "zh");
    document.documentElement.classList.toggle("font-deva", l === "hi");
    document.documentElement.classList.toggle("font-el", l === "el");
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => SSR_DEFAULT);
}

type Vars = Record<string, string | number>;

export function t(key: MsgKey, vars?: Vars): string {
  return fill(DICT[locale][key] ?? en[key] ?? key, vars);
}

export function translate(loc: Locale, key: MsgKey, vars?: Vars): string {
  return fill(DICT[loc][key] ?? en[key] ?? key, vars);
}

function fill(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function useT() {
  const loc = useLocale();
  return useCallback((key: MsgKey, vars?: Vars) => translate(loc, key, vars), [loc]);
}

export function errMsg(raw: string, loc: Locale = locale): string {
  const prefixed = `err.${raw}` as MsgKey;
  if (prefixed in en) return translate(loc, prefixed);
  if (raw in en) return translate(loc, raw as MsgKey);
  return raw;
}

export function maybeT(raw: string, vars?: Vars): string {
  if (raw in en) return t(raw as MsgKey, vars);
  return raw;
}

export function countryName(code: string, loc: Locale = locale): string {
  const key = `country.${code}` as MsgKey;
  if (key in en) return translate(loc, key);
  return code;
}

export function I18nBoot() {
  useEffect(() => {
    setLocale(detectLocale());
  }, []);
  return null;
}
