import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { prepareNativeAuthRequest } from "@/lib/auth/native-request";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(prepareNativeAuthRequest(request)),
      POST: ({ request }) => auth.handler(prepareNativeAuthRequest(request)),
    },
  },
});
