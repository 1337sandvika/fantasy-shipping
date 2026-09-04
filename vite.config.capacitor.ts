/**
 * Client-only SPA build for the Capacitor iOS wrapper.
 *
 * Regular `vite.config.ts` stays on Nitro/Vercel for the hosted website.
 * This config prerenders a static shell + JS/CSS/assets into `www/` so the
 * native app does not load the grok.me URL as its UI (Guideline 4.2).
 */
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "www",
    emptyOutDir: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
        },
      },
    }),
    viteReact(),
  ],
});
