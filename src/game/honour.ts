import type { MsgKey } from "@/i18n";
import type { Honour } from "./types";

export function honourLabel(
  h: Pick<Honour, "kind" | "brand" | "n">,
  t: (k: MsgKey, v?: Record<string, string | number>) => string,
): string {
  if (h.kind === "brand") return t("honour.brand", { brand: h.brand ?? "OEM" });
  if (h.kind === "green") return t("honour.green");
  if (h.kind === "streak") return t("honour.streak", { n: h.n ?? 0 });
  if (h.kind === "ceu") return t("honour.ceu", { n: h.n ?? 0 });
  if (h.kind === "ice") return t("honour.ice");
  if (h.kind === "daily") return t("honour.daily", { n: h.n ?? 1 });
  if (h.kind === "challenge") return t("honour.challenge");
  return t("honour.brand", { brand: "OEM" });
}
