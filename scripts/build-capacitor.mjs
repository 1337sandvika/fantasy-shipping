#!/usr/bin/env node
/**
 * Build the local web bundle Capacitor copies into the iOS app.
 *
 * 1. Vite SPA build (vite.config.capacitor.ts) → www/
 * 2. Guarantee index.html exists (Start may emit _shell.html)
 * 3. Copy public/ game art if the SPA pass missed a static file
 * 4. Optional: `npx cap sync ios`
 */
import { spawn } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeAppEnv, projectRoot, readAppEnv } from "./with-app-env.mjs";

const DEFAULT_API = "https://palm-river-olive-field.grok.me";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env, cwd: projectRoot() });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

function copyIfMissing(from, to) {
  if (!existsSync(from)) return;
  if (existsSync(to)) return;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

/** TanStack Start writes the SPA client to `www/client/` (+ unused `www/server/`). */
function flattenClientBundle(www) {
  const client = join(www, "client");
  const server = join(www, "server");
  if (existsSync(client)) {
    for (const name of readdirSync(client)) {
      const from = join(client, name);
      const to = join(www, name);
      if (existsSync(to)) rmSync(to, { recursive: true, force: true });
      renameSync(from, to);
    }
    rmSync(client, { recursive: true, force: true });
  }
  if (existsSync(server)) rmSync(server, { recursive: true, force: true });
}

function ensureIndexHtml(www) {
  flattenClientBundle(www);
  const index = join(www, "index.html");
  if (existsSync(index)) return;
  for (const name of ["_shell.html", "shell.html"]) {
    const candidate = join(www, name);
    if (existsSync(candidate)) {
      copyFileSync(candidate, index);
      return;
    }
  }
  const outputPublic = join(projectRoot(), ".output", "public");
  for (const name of ["index.html", "_shell.html"]) {
    const candidate = join(outputPublic, name);
    if (existsSync(candidate)) {
      copyTree(outputPublic, www);
      if (!existsSync(index) && existsSync(join(www, "_shell.html"))) {
        copyFileSync(join(www, "_shell.html"), index);
      }
      return;
    }
  }
  throw new Error("Capacitor build produced no index.html / _shell.html — cannot sync iOS");
}

function copyTree(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true, force: false });
}

function mirrorPublicGameAssets(www) {
  const publicDir = join(projectRoot(), "public");
  if (!existsSync(publicDir)) return;
  const walk = (rel) => {
    const src = join(publicDir, rel);
    const st = statSync(src);
    if (st.isDirectory()) {
      for (const name of readdirSync(src)) walk(join(rel, name));
      return;
    }
    copyIfMissing(src, join(www, rel));
  };
  walk(".");
}

async function main() {
  const root = projectRoot();
  const www = join(root, "www");
  const sync = process.argv.includes("--sync") || process.argv.includes("sync");
  const env = mergeAppEnv(readAppEnv(root), {
    ...process.env,
    VITE_NATIVE: process.env.VITE_NATIVE || "1",
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || DEFAULT_API,
  });

  console.log(`[build-capacitor] API base: ${env.VITE_API_BASE_URL}`);
  await run("npx", ["vite", "build", "--config", "vite.config.capacitor.ts"], env);

  const outputPublic = join(root, ".output", "public");
  if (!existsSync(join(www, "index.html")) && existsSync(outputPublic)) {
    copyTree(outputPublic, www);
  }
  ensureIndexHtml(www);
  mirrorPublicGameAssets(www);

  if (sync) {
    if (!existsSync(join(root, "ios"))) {
      console.warn("[build-capacitor] ios/ missing — run `npx cap add ios` on this machine or a Mac");
      return;
    }
    await run("npx", ["cap", "sync", "ios"], env);
  }
  console.log("[build-capacitor] www/ ready for Capacitor");
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
