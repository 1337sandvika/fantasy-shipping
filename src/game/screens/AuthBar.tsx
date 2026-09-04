import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";
import { useT } from "@/i18n";

const subscribeToNothing = () => () => {};
const noGateOnServer = () => false;

export function AuthBar({ extra, showTable = true }: { extra?: ReactNode; showTable?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateOnServer);
  const t = useT();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <LanguageSwitch compact />
      {extra}
      {showTable ? (
        <Link
          to="/scoreboard"
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-bg-elevated/90 px-3 text-xs font-medium text-muted hover:text-fg"
        >
          {t("auth.board")}
        </Link>
      ) : null}
      {isPending ? (
        <div className="h-11 w-28 animate-pulse rounded-md bg-surface" />
      ) : user ? (
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-bg-elevated/90 px-2.5">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-surface text-xs font-medium">
              {(user.displayName ?? user.primaryEmail ?? t("auth.captain")).charAt(0).toUpperCase()}
            </span>
          )}
          <span className="max-w-[9rem] truncate text-xs font-medium">
            {user.displayName ?? user.primaryEmail ?? t("auth.captain")}
          </span>
          {authEnabled && !gateSession ? (
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
              className={cn(
                "text-xs text-muted underline-offset-4 hover:text-fg hover:underline",
                "disabled:cursor-wait disabled:no-underline",
              )}
            >
              {signingOut ? t("auth.signingOut") : t("auth.signOut")}
            </button>
          ) : null}
        </div>
      ) : (
        <Link
          to="/login"
          search={{ next: "/" }}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg"
        >
          {t("auth.signIn")}
        </Link>
      )}
    </div>
  );
}
