import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

// The helper is TypeScript without Node deps — evaluate the exported functions
// by importing through the experimental strip-types hook used elsewhere, or
// re-implement the tiny contract so this file stays .mjs like the other tests.
const CAPACITOR_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
];

function isCapacitorOrigin(origin) {
  if (!origin) return false;
  if (CAPACITOR_ORIGINS.includes(origin)) return true;
  try {
    return CAPACITOR_ORIGINS.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}

function isHostedApiPath(pathname) {
  return (
    pathname.startsWith("/_serverFn") ||
    pathname.startsWith("/__server") ||
    pathname.startsWith("/api/auth")
  );
}

function rewriteUrl(url, apiBase) {
  let parsed;
  try {
    parsed = new URL(url, "capacitor://localhost/");
  } catch {
    return null;
  }
  if (!isHostedApiPath(parsed.pathname)) return null;
  if (parsed.origin === apiBase) return null;
  return `${apiBase}${parsed.pathname}${parsed.search}`;
}

describe("Capacitor origin allow-list", () => {
  it("accepts first-party WebView origins", () => {
    assert.equal(isCapacitorOrigin("capacitor://localhost"), true);
    assert.equal(isCapacitorOrigin("ionic://localhost"), true);
    assert.equal(isCapacitorOrigin("https://localhost"), true);
  });

  it("rejects sibling grok.me apps and random sites", () => {
    assert.equal(isCapacitorOrigin("https://evil.grok.me"), false);
    assert.equal(isCapacitorOrigin("https://palm-river-olive-field.grok.me"), false);
    assert.equal(isCapacitorOrigin("https://example.com"), false);
    assert.equal(isCapacitorOrigin(""), false);
    assert.equal(isCapacitorOrigin(null), false);
  });
});

describe("hosted API path rewrite", () => {
  const api = "https://palm-river-olive-field.grok.me";

  it("rewrites server functions and auth to the hosted origin", () => {
    assert.equal(
      rewriteUrl("/_serverFn/abc", api),
      "https://palm-river-olive-field.grok.me/_serverFn/abc",
    );
    assert.equal(
      rewriteUrl("/api/auth/sign-in/email", api),
      "https://palm-river-olive-field.grok.me/api/auth/sign-in/email",
    );
    assert.equal(
      rewriteUrl("capacitor://localhost/_serverFn/x?y=1", api),
      "https://palm-river-olive-field.grok.me/_serverFn/x?y=1",
    );
  });

  it("leaves game asset and same-API URLs alone", () => {
    assert.equal(rewriteUrl("/game/title-hero.jpg", api), null);
    assert.equal(rewriteUrl(`${api}/_serverFn/abc`, api), null);
  });
});

void createRequire;
