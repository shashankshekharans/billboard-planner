import { describe, expect, it } from "vitest";
import { area, planTotals, rent, siteTotal } from "./costs.js";
import type { GroupData, SiteData } from "./model.js";

const site = (o: Partial<SiteData>): SiteData => ({
  id: "x", group: "hwy", mediaVehicle: "Hoarding", location: "", facing: "", lat: 28, lng: 77,
  widthFt: 40, heightFt: 20, qty: 1, illumination: "N/L", ratePerMonth: 24000, days: 30, printing: 8000, photos: [], ...o
});

// AAJ Swift example, sample rates
const GROUPS: GroupData[] = [
  { id: "hwy", name: "Delhi Jaipur Highway", color: "#0f6b3e" },
  { id: "binalo", name: "Binalo – Near Stella Showroom", color: "#c27a06" }
];
const AAJ: SiteData[] = [
  site({ id: "1", widthFt: 40, heightFt: 30, ratePerMonth: 36000, printing: 12000 }),
  site({ id: "2" }), site({ id: "3" }), site({ id: "4" }),
  site({ id: "5", ratePerMonth: 26000 }),
  site({ id: "6", widthFt: 80, heightFt: 30, ratePerMonth: 72000, printing: 24000 }),
  site({ id: "7", widthFt: 50, heightFt: 20, ratePerMonth: 32000, printing: 10000 }),
  site({ id: "8", group: "binalo", widthFt: 30, heightFt: 15, ratePerMonth: 150000, printing: "extra", taxNote: "GST extra" })
];

describe("site maths", () => {
  it("area = width × height × qty", () => {
    expect(area(site({ widthFt: 40, heightFt: 30 }))).toBe(1200);
    expect(area(site({ widthFt: 20, heightFt: 10, qty: 2 }))).toBe(400);
  });
  it("rent is the monthly rate for 30 days and scales with days", () => {
    expect(rent(site({ ratePerMonth: 36000 }))).toBe(36000);
    expect(rent(site({ ratePerMonth: 36000, days: 60 }))).toBe(72000);
    expect(rent(site({ ratePerMonth: 1000, days: 45 }))).toBe(1500);
    expect(rent(site({ ratePerMonth: 1000, days: 10 }))).toBe(333);
  });
  it("total = rent + one-time printing; open printing counts as 0 and is flagged", () => {
    expect(siteTotal(site({ ratePerMonth: 36000, printing: 12000 }))).toEqual({ total: 48000, open: false });
    expect(siteTotal(site({ ratePerMonth: 150000, printing: "extra" }))).toEqual({ total: 150000, open: true });
    expect(siteTotal(site({ ratePerMonth: 5000, printing: "tbc", days: 60 }))).toEqual({ total: 10000, open: true });
  });
});

describe("planTotals: AAJ Swift example", () => {
  const t = planTotals(AAJ, GROUPS);
  it("highway subtotal", () => {
    expect(t.groups[0]).toMatchObject({ id: "hwy", count: 7, area: 7800, rate: 238000, printing: 78000, total: 316000, open: false });
  });
  it("Binalo subtotal is open (printing extra)", () => {
    expect(t.groups[1]).toMatchObject({ id: "binalo", count: 1, area: 450, rate: 150000, printing: 0, total: 150000, open: true });
  });
  it("grand total ₹4,66,000*", () => {
    expect(t.grand).toEqual({ count: 8, area: 8250, rate: 388000, printing: 78000, total: 466000, open: true });
  });
  it("skips empty groups and ignores sites in unknown groups", () => {
    const u = planTotals([site({ group: "nope" }), site({})], [...GROUPS, { id: "empty", name: "E", color: "#000" }]);
    expect(u.groups.map(g => g.id)).toEqual(["hwy"]);
    expect(u.grand.count).toBe(1);
  });
});
