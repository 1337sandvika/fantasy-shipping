import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLand, lerpLonLat, segmentHitsLand } from "./geo.ts";
import { followWater, pointOnPath, pointOnPathStepped, quayPoint, seaRoute } from "./route.ts";
import { PORTS } from "./data/ports.ts";

describe("arrival clamp", () => {
  it("pointOnPath never goes past the last waypoint", () => {
    const path = [
      { lon: 0, lat: 50 },
      { lon: 2, lat: 50 },
      { lon: 4, lat: 51 },
    ];
    const last = path[2]!;
    for (const t of [1, 1.2, 9]) {
      const p = pointOnPath(path, t);
      assert.equal(p.lon, last.lon);
      assert.equal(p.lat, last.lat);
    }
  });

  it("pointOnPathStepped lands on the destination when travelled >= nm", () => {
    const path = [
      { lon: 3.2, lat: 51.33 },
      { lon: 1.3, lat: 51.05 },
      { lon: -1.4, lat: 50.9 },
    ];
    const nm = 400;
    const p = pointOnPathStepped(path, nm, nm);
    const last = path[path.length - 1]!;
    assert.equal(p.lon, last.lon);
    assert.equal(p.lat, last.lat);
    const over = pointOnPathStepped(path, nm + 80, nm);
    assert.equal(over.lon, last.lon);
    assert.equal(over.lat, last.lat);
  });

  it("lerp t>1 does not overshoot", () => {
    const a = { lon: 0, lat: 0 };
    const b = { lon: 10, lat: 5 };
    const p = lerpLonLat(a, b, 1.5);
    assert.equal(p.lon, b.lon);
    assert.equal(p.lat, b.lat);
  });
});

describe("quay / water landing", () => {
  it("quay points sit in water for every port", () => {
    for (const p of PORTS) {
      const q = quayPoint(p.id);
      assert.equal(isLand(q.lon, q.lat), false, `${p.id} quay is on land ${q.lon},${q.lat}`);
    }
  });
});

describe("sea routes stay on water", () => {
  const pairs: [string, string][] = [
    ["southampton", "barcelona"],
    ["setubal", "livorno"],
    ["livorno", "piraeus"],
    ["zeebrugge", "goteborg"],
    ["baltimore", "santos"],
    ["singapore", "yokohama"],
    ["longbeach", "yokohama"],
    ["vigo", "tangier"],
    ["dublin", "fos"],
    ["jacksonville", "veracruz"],
  ];

  it("computed corridors do not cut across land", () => {
    for (const [a, b] of pairs) {
      const { path } = seaRoute(a, b);
      assert.ok(path.length >= 2, `${a}>${b} empty`);
      for (let i = 0; i < path.length - 1; i++) {
        const hits = segmentHitsLand(path[i]!, path[i + 1]!, 22);
        assert.equal(hits, false, `${a}>${b} segment ${i} ${path[i]!.lon},${path[i]!.lat} -> ${path[i + 1]!.lon},${path[i + 1]!.lat}`);
      }
    }
  });

  it("followWater repairs a straight land-cutting chord", () => {
    const a = { lon: -1.4, lat: 50.9 };
    const b = { lon: 2.17, lat: 41.35 };
    assert.equal(segmentHitsLand(a, b, 24), true);
    const water = followWater([a, b]);
    for (let i = 0; i < water.length - 1; i++) {
      assert.equal(segmentHitsLand(water[i]!, water[i + 1]!, 20), false);
    }
  });

  it("southampton to barcelona stays a coastal Gibraltar run", () => {
    const { path, nm } = seaRoute("southampton", "barcelona");
    assert.ok(nm > 900 && nm < 2600, `unexpected length ${nm}`);
    assert.ok(path.some((p) => p.lat < 37.5 && p.lon > -10 && p.lon < -4), "missing Gibraltar");
    assert.equal(
      path.some((p) => p.lon < -14),
      false,
      "detoured into the mid-Atlantic",
    );
  });
});
