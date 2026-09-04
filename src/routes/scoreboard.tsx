import { createFileRoute } from "@tanstack/react-router";
import { ScoreboardScreen } from "@/game/screens/ScoreboardScreen";

export const Route = createFileRoute("/scoreboard")({ component: ScoreboardScreen });
