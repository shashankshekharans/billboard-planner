import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { planTotals } from "./costs.js";
import { haversineKm } from "./geo.js";
import { PlanError, resolvePlan } from "./resolve.js";

const repo = new URL("../../../", import.meta.url);
const exampleYaml = () => parse(readFileSync(new URL("examples/aaj-swift-nh48/plan.yaml", repo), "utf8"));
// The data that renders a page identical to the reference build (checked in Stage 2).
const fixture = JSON.parse(readFileSync(new URL("packages/template/test/fixtures/aaj-swift-nh48.json", repo), "utf8"));

const minimal = (over: Record<string, unknown> = {}, site: Record<string, unknown> = {}) => ({
  plan: { groups: [{ id: "a", name: "Route A", color: "#2255aa" }], ...over },
  sites: [{ id: 1, group: "a", location: "Board", coords: "28.1, 76.6", width_ft: 40, height_ft: 20, rate_per_month: 1000, ...site }]
});
const problems = (input: unknown) => {
  try { resolvePlan(input); } catch (e) { if (e instanceof PlanError) return e.issues; throw e; }
  throw new Error("expected a PlanError");
};

describe("resolvePlan: AAJ Swift example", () => {
  const { plan, warnings } = resolvePlan(exampleYaml());

  it("matches the reference page data exactly", () => {
    expect(plan).toEqual({ ...fixture, theme: "light" });
  });
  it("has no warnings", () => expect(warnings).toEqual([]));
  it("keeps the reference totals: 8 sites, 8,250 sq ft, ₹4,66,000*", () => {
    expect(planTotals(plan.sites, plan.groups).grand).toEqual({ count: 8, area: 8250, rate: 388000, printing: 78000, total: 466000, open: true });
  });
  it("keeps the reference distances from the warehouse", () => {
    const wh = plan.bases[0]!;
    expect(plan.sites.map(s => haversineKm(wh, s).toFixed(1))).toEqual(["30.3", "22.3", "21.7", "21.6", "17.0", "13.8", "13.7", "9.1"]);
  });
  it("labels the plan as sample rates", () => {
    expect(plan.subtitle).toMatch(/Sample rates for demonstration/);
    expect(plan.notes.join(" ")).toMatch(/sample figures/);
  });
});

describe("resolvePlan: defaults", () => {
  const { plan } = resolvePlan(minimal());
  it("fills plan defaults", () => {
    expect(plan).toMatchObject({
      title: "Billboard Plan", subtitle: "", currency: "INR", locale: "en-IN", theme: "light",
      brand: { primary: "#c1202d" }, bases: [], notes: [],
      map: { defaultView: "satellite", providers: { satellite: "esri-imagery", road: "esri-street" } }
    });
    expect(plan.rings).toBeUndefined();
  });
  it("fills site defaults; missing printing is TBC", () => {
    expect(plan.sites[0]).toEqual({
      id: "1", group: "a", mediaVehicle: "", location: "Board", facing: "", lat: 28.1, lng: 76.6,
      widthFt: 40, heightFt: 20, qty: 1, illumination: "", ratePerMonth: 1000, days: 30, printing: "tbc", photos: []
    });
  });
  it("accepts Extra / TBC in any case, and lat + lng instead of coords", () => {
    const { plan } = resolvePlan(minimal({}, { printing: "Extra", coords: undefined, lat: 12.9, lng: 77.6 }));
    expect(plan.sites[0]).toMatchObject({ printing: "extra", lat: 12.9, lng: 77.6 });
    expect(resolvePlan(minimal({}, { printing: "To be confirmed" })).plan.sites[0]!.printing).toBe("tbc");
  });
  it("centres rings on a base", () => {
    const { plan } = resolvePlan(minimal({
      bases: [{ id: "wh", name: "Warehouse", label: "warehouse", coords: "28.24, 76.93", distance_from: true }],
      rings: { center: { base: "wh" }, radii_km: [10] }
    }));
    expect(plan.rings).toEqual({ center: { lat: 28.24, lng: 76.93, label: "warehouse" }, radiiKm: [10], visible: true });
  });
  it("passes a custom tile provider through", () => {
    const { plan } = resolvePlan(minimal({ map: { providers: { road: { url: "https://tiles.example.com/{z}/{x}/{y}.png", attribution: "© Example", max_zoom: 18 } } } }));
    expect(plan.map.providers).toEqual({ satellite: "esri-imagery", road: { url: "https://tiles.example.com/{z}/{x}/{y}.png", attribution: "© Example", maxZoom: 18 } });
  });
});

describe("resolvePlan: problems are reported clearly", () => {
  it("lists every problem with where it is", () => {
    const issues = problems(minimal({}, { width_ft: -4, rate_per_month: "lots" }));
    expect(issues).toHaveLength(2);
    expect(issues.join("\n")).toMatch(/sites\[0\]\.width_ft \(site 1\)/);
    expect(issues.join("\n")).toMatch(/sites\[0\]\.rate_per_month \(site 1\)/);
  });
  it("reports a misspelt key", () => {
    expect(problems(minimal({}, { widht_ft: 40 })).join("\n")).toMatch(/widht_ft/);
  });
  it("reports unreadable coordinates with the site", () => {
    expect(problems(minimal({}, { coords: "near the flyover" }))).toEqual([`sites[0].coords (site 1): No coordinates found in "near the flyover"`]);
  });
  it("reports a site with no position", () => {
    expect(problems(minimal({}, { coords: undefined })).join("\n")).toMatch(/coords .* or both lat and lng/);
  });
  it("reports an unknown group, duplicate ids and an unknown ring base", () => {
    const input = minimal({ rings: { center: { base: "nope" }, radii_km: [20] } }, { group: "b" });
    input.sites.push({ ...input.sites[0]!, group: "a" });
    const issues = problems(input).join("\n");
    expect(issues).toMatch(/no group with id "b"/);
    expect(issues).toMatch(/Site id "1" is used more than once/);
    expect(issues).toMatch(/no base with id "nope"/);
  });
  it("rejects a bad colour and a bad printing value", () => {
    const issues = problems(minimal({ groups: [{ id: "a", name: "A", color: "green" }] }, { printing: "maybe" })).join("\n");
    expect(issues).toMatch(/hex colour/);
    expect(issues).toMatch(/"extra" or "tbc"/);
  });
});

describe("resolvePlan: warnings", () => {
  it("warns about a far-away site and swapped coordinates", () => {
    const input = exampleYaml();
    input.sites.push({ ...input.sites[0], id: "9", coords: "76.65, 28.13" });
    const { warnings } = resolvePlan(input);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Site 9 .* km from the other sites\. Latitude and longitude look swapped\./);
  });
  it("warns about an empty group", () => {
    const { warnings } = resolvePlan(minimal({ groups: [{ id: "a", name: "A", color: "#000" }, { id: "b", name: "B", color: "#fff" }] }));
    expect(warnings).toEqual(['Group "B" has no sites.']);
  });
});

describe("planToFile", () => {
  it("round-trips: resolvePlan(planToFile(data)) gives the same data", async () => {
    const { planToFile } = await import("./tofile.js");
    const { plan } = resolvePlan(exampleYaml());
    expect(resolvePlan(planToFile(plan)).plan).toEqual(plan);
    expect(resolvePlan(planToFile({ ...fixture, theme: "light" })).plan).toEqual({ ...fixture, theme: "light" });
  });
  it("round-trips a custom tile provider and no rings", async () => {
    const { planToFile } = await import("./tofile.js");
    const { plan } = resolvePlan(minimal({ map: { providers: { road: { url: "https://t.example.com/{z}/{x}/{y}.png", max_zoom: 18 } } } }));
    expect(resolvePlan(planToFile(plan)).plan).toEqual(plan);
  });
});
