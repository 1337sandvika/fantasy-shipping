import { LOCALES, useLocale, setLocale, isLocale, useT } from "./index";

export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0]!;
  return (
    <label className="inline-flex min-h-11 items-center gap-2">
      <span className={compact ? "sr-only" : "text-[10px] uppercase tracking-wider text-subtle"}>{t("lang.label")}</span>
      <select
        aria-label={t("lang.label")}
        value={locale}
        onChange={(e) => {
          const v = e.target.value;
          if (isLocale(v)) setLocale(v);
        }}
        className="field min-h-11 w-auto px-2 text-xs font-medium"
      >
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id} lang={l.html}>
            {l.native}
          </option>
        ))}
      </select>
      <span className="sr-only">{current.native}</span>
    </label>
  );
}
