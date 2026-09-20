/** Load house fonts after first paint so the preview iframe never blocks on Google Fonts. */

const LATIN =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap";

const EXTRA: Record<string, string> = {
  zh: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&display=swap",
  hi: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&display=swap",
  el: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600&display=swap",
};

function inject(id: string, href: string) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  link.media = "print";
  link.onload = () => {
    link.media = "all";
  };
  document.head.appendChild(link);
}

export function loadHarbourFonts(locale?: string) {
  inject("harbour-fonts-latin", LATIN);
  if (locale === "zh") inject("harbour-fonts-zh", EXTRA.zh);
  else if (locale === "hi") inject("harbour-fonts-hi", EXTRA.hi);
  else if (locale === "el") inject("harbour-fonts-el", EXTRA.el);
}
