import { describe, expect, it } from "vitest";
import { findOutliers, haversineKm } from "./geo.js";

const WAREHOUSE = { lat: 28.24132198237465, lng: 76.9355599373958 };
// AAJ Swift sites: decimal coordinates and the distances shown in the reference plan
const SITES = [
  { id: "1", lat: 28.135394, lng: 76.650181, km: "30.3" },
  { id: "2", lat: 28.182914, lng: 76.717585, km: "22.3" },
  { id: "3", lat: 28.186815, lng: 76.722692, km: "21.7" },
  { id: "4", lat: 28.187389, lng: 76.723787, km: "21.6" },
  { id: "5", lat: 28.204861, lng: 76.767246, km: "17.0" },
  { id: "6", lat: 28.220244, lng: 76.796553, km: "13.8" },
  { id: "7", lat: 28.221989, lng: 76.797893, km: "13.7" },
  { id: "8", lat: 28.30119, lng: 76.872404, km: "9.1" }
];

describe("haversineKm", () => {
  it("matches the reference plan's warehouse distances", () => {
    for (const s of SITES) expect(haversineKm(WAREHOUSE, s).toFixed(1)).toBe(s.km);
  });
  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(WAREHOUSE, WAREHOUSE)).toBe(0);
    expect(haversineKm(SITES[0]!, SITES[7]!)).toBeCloseTo(haversineKm(SITES[7]!, SITES[0]!), 9);
  });
  it("gives a known long distance (Delhi to Mumbai, about 1,150 km)", () => {
    expect(haversineKm({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 })).toBeGreaterThan(1130);
    expect(haversineKm({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 })).toBeLessThan(1170);
  });
});

describe("findOutliers", () => {
  it("finds nothing in the AAJ Swift plan", () => {
    expect(findOutliers(SITES)).toEqual([]);
  });
  it("flags a site far from the rest", () => {
    const out = findOutliers([...SITES, { id: "9", lat: 19.076, lng: 72.8777 }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("9");
    expect(out[0]!.km).toBeGreaterThan(900);
    expect(out[0]!.swapped).toBe(false);
  });
  it("spots latitude and longitude written the wrong way round", () => {
    const out = findOutliers([...SITES, { id: "9", lat: 76.75, lng: 28.2 }]);
    expect(out.map(o => o.id)).toEqual(["9"]);
    expect(out[0]!.swapped).toBe(true);
  });
  it("needs at least three points", () => {
    expect(findOutliers([SITES[0]!, { id: "x", lat: 19, lng: 72 }])).toEqual([]);
  });
});
