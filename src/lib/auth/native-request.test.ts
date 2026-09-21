import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accountFormError,
  classifyAuthError,
  prepareNativeAuthRequest,
  shouldOfferSocialLogin,
} from "./native-request.ts";

describe("prepareNativeAuthRequest", () => {
  it("rewrites a null Origin from the native client to capacitor://localhost", async () => {
    const request = new Request("https://palm-river-olive-field.grok.me/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        origin: "null",
        "content-type": "application/json",
        "x-fantasy-shipping-client": "capacitor",
      },
      body: "{}",
    });
    const next = prepareNativeAuthRequest(request);
    assert.equal(next.headers.get("origin"), "capacitor://localhost");
    assert.equal(await next.text(), "{}");
  });

  it("leaves a real capacitor origin and website requests alone", () => {
    const native = new Request("https://example.com/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: "capacitor://localhost", "x-fantasy-shipping-client": "capacitor" },
      body: "{}",
    });
    assert.equal(prepareNativeAuthRequest(native).headers.get("origin"), "capacitor://localhost");

    const web = new Request("https://example.com/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "null" },
      body: "{}",
    });
    assert.equal(prepareNativeAuthRequest(web).headers.get("origin"), "null");
  });
});

describe("classifyAuthError", () => {
  it("maps review-facing failures to stable kinds", () => {
    assert.equal(classifyAuthError(new Error("Failed to fetch")), "network");
    assert.equal(classifyAuthError(new Error("timeout")), "timeout");
    assert.equal(classifyAuthError(new Error("Invalid origin")), "origin");
    assert.equal(classifyAuthError({ message: "User already exists" }), "exists");
    assert.equal(classifyAuthError(new Error("Invalid email or password")), "creds");
  });
});

describe("accountFormError", () => {
  it("requires a real email and 8 character password before the request", () => {
    assert.equal(accountFormError({ email: "not-an-email", password: "longenough" }), "email");
    assert.equal(accountFormError({ email: "a@b.co", password: "short" }), "password");
    assert.equal(accountFormError({ email: "  reviewer@apple.com ", password: "review-pass" }), null);
  });
});

describe("shouldOfferSocialLogin", () => {
  it("hides Google and X on iPhone, iPad, and iPadOS desktop UA", () => {
    assert.equal(
      shouldOfferSocialLogin({
        userAgent: "Mozilla/5.0 (iPad; CPU OS 27_0 like Mac OS X)",
        platform: "ios",
        maxTouchPoints: 5,
        standalone: true,
        hasWebkitHandlers: true,
      }),
      false,
    );
    assert.equal(
      shouldOfferSocialLogin({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "web",
        maxTouchPoints: 5,
        standalone: false,
        hasWebkitHandlers: true,
      }),
      false,
    );
  });

  it("keeps social login on a desktop browser", () => {
    assert.equal(
      shouldOfferSocialLogin({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "web",
        maxTouchPoints: 0,
        standalone: false,
        hasWebkitHandlers: false,
      }),
      true,
    );
  });
});
