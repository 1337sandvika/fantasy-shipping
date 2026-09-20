import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";
import { deleteMyAccount } from "@/game/score-api";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(t("privacy.deleteConfirm"))) return;
    setBusy(true);
    setNote(null);
    try {
      await deleteMyAccount({ data: {} });
      setNote(t("privacy.deleted"));
      try {
        const { signOut } = await import("@/lib/auth/client");
        await signOut("/");
      } catch {
        window.location.href = "/";
      }
    } catch {
      setBusy(false);
      setNote(t("privacy.deleteFail"));
    }
  }

  return (
    <div className="safe-pad harbour-grain relative flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      <img src="/game/title-hero.jpg?v=3" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="harbour-hero absolute inset-0" />
      <div className="relative z-10 flex justify-end px-4 pt-4">
        <LanguageSwitch compact />
      </div>
      <div className="screen-in relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-end px-5 pb-10 pt-8 sm:justify-center">
        <p className="kicker">{t("privacy.kicker")}</p>
        <h1 className="mt-2 font-display text-4xl">{t("privacy.title")}</h1>
        <p className="mt-1 text-xs text-subtle">{t("privacy.updated")}</p>
        <p className="mt-4 text-sm text-muted">{t("privacy.p1")}</p>
        <p className="mt-3 text-sm text-muted">{t("privacy.p2")}</p>
        <p className="mt-3 text-sm text-muted">{t("privacy.p3")}</p>
        <p className="mt-3 text-xs text-subtle">{t("about.legal")}</p>
        {!isPending && user ? (
          <div className="panel mt-6 p-4">
            <p className="text-sm text-muted">{t("privacy.deleteHint")}</p>
            <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => void onDelete()}>
              {busy ? t("privacy.deleting") : t("privacy.delete")}
            </Button>
            {note ? <p className="mt-2 text-xs text-subtle">{note}</p> : null}
          </div>
        ) : null}
        <Link to="/" className="link-quiet mt-8">
          {t("privacy.back")}
        </Link>
      </div>
    </div>
  );
}
