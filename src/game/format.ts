const TAG: Record<string, string> = {
  en: "en",
  zh: "zh-CN",
  hi: "hi-IN",
  es: "es",
  nb: "nb-NO",
  de: "de",
  fr: "fr",
  nl: "nl",
  pt: "pt",
  it: "it",
  pl: "pl",
  el: "el",
  tr: "tr",
};

let tag = "en";
let eur = new Intl.NumberFormat(tag, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
let num = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
let num1 = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
let num3 = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
let dateFmt = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" });
let daysFmt: ((delta: number, n: string) => string) | null = null;

export function setFormatLocale(locale: string) {
  tag = TAG[locale] ?? "en";
  eur = new Intl.NumberFormat(tag, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  num = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  num1 = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  num3 = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  dateFmt = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" });
}

export function setDaysLeftFmt(fn: (delta: number, n: string) => string) {
  daysFmt = fn;
}

export function money(n: number): string {
  return eur.format(Math.round(n));
}

export function qty(n: number): string {
  return num.format(Math.round(n));
}

export function qty1(n: number): string {
  return num1.format(n);
}

export function qty3(n: number): string {
  return num3.format(n);
}

const START = Date.UTC(2026, 2, 2);

export function dateFromDay(day: number): Date {
  return new Date(START + day * 86400000);
}

export function formatDate(day: number): string {
  return dateFmt.format(dateFromDay(day));
}

export function monthIndex(day: number): number {
  return dateFromDay(day).getUTCMonth();
}

/** Year*12 + month so ETS fires once per calendar month, including year wrap. */
export function monthKey(day: number): number {
  const d = dateFromDay(day);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function isWinter(day: number): boolean {
  const m = monthIndex(day);
  return m === 11 || m === 0 || m === 1 || m === 2;
}

export function daysLeft(deadline: number, day: number): string {
  const d = deadline - day;
  const n = qty1(Math.abs(d));
  if (daysFmt) return daysFmt(d, n);
  if (d < -0.05) return `${n} d late`;
  if (d < 1) return "due today";
  return `${n} d left`;
}
