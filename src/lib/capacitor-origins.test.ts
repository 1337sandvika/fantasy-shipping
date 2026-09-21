import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { corsAllowOrigin, isCapacitorOrigin, nativeOriginOverride } from "./capacitor-origins.ts";

describe("native origin for App Review sign-up", () => {
  it("treats the opaque capacitor origin as needing a rewrite", () => {
    assert.equal(isCapacitorOrigin("null"), false);
    assert.equal(isCapacitorOrigin("capacitor://localhost"), true);
    assert.equal(nativeOriginOverride("null", "capacitor"), "capacitor://localhost");
    assert.equal(nativeOriginOverride(null, "capacitor"), "capacitor://localhost");
    assert.equal(nativeOriginOverride("capacitor://localhost", "capacitor"), null);
    assert.equal(nativeOriginOverride("null", null), null);
  });

  it("reflects Origin null only for the native client header", () => {
    assert.equal(corsAllowOrigin("capacitor://localhost", null), "capacitor://localhost");
    assert.equal(corsAllowOrigin("null", "capacitor"), "null");
    assert.equal(corsAllowOrigin("null", null), null);
    assert.equal(corsAllowOrigin("https://evil.example", "capacitor"), null);
  });
});
