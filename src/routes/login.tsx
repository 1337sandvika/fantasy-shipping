import { lazy, Suspense } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authEnabled } from "@/lib/auth/enabled";

type LoginSearch = { next?: "/" | "/scoreboard"; mode?: "up" };

const LoginForm = lazy(() => import("@/game/screens/LoginScreen"));

export const Route = createFileRoute("/login")({
  validateSearch: (raw: Record<string, unknown>): LoginSearch => ({
    ...(raw.next === "/scoreboard" ? { next: "/scoreboard" as const } : {}),
    ...(raw.mode === "up" ? { mode: "up" as const } : {}),
  }),
  component: LoginGate,
});

function LoginGate() {
  if (!authEnabled) return <Navigate to="/" />;
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}
