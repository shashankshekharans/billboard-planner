// Stage 5 check: the AAJ Swift plan built from examples/aaj-swift-nh48/plan.yaml must match the hand-made
// reference page, read straight from the data block inside billboard-plan-example.html.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { haversineKm, planTotals } from "@billboard-planner/core";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "./build.js";

const EXAMPLE = fileURLToPath(new URL("../../../examples/aaj-swift-nh48/", import.meta.url));

interface RefSite { g: string; mv: string; lat: number; lng: number; loc: string; facing: string; w: number; h: number; qty: number; illum: string; rate: number; days: number; print: number | null; gstExtra?: boolean; photos: string[] }
interface Ref {
  LOGO: string; WH_LOGO: string; SITES: RefSite[];
  WAREHOUSE: { lat: number; lng: number; name: string }; GURGAON: { lat: number; lng: number }; RINGS_KM: number[];
  GROUPS: Record<string, { name: string }>;
  CITIES: { name: string; lat: number; lng: number }[];
}

// The reference keeps its data between these markers as plain `const` declarations.
function referenceData(): Ref {
  const html = readFileSync(join(EXAMPLE, "reference/billboard-plan-example.html"), "utf8");
  const block = html.match(/\/\* ===== DATA — edit here ===== \*\/([\s\S]*?)\/\* ===== END DATA ===== \*\//)![1]!;
  return runInNewContext(`${block}\n({ LOGO, WH_LOGO, SITES, WAREHOUSE, GURGAON, RINGS_KM, GROUPS, CITIES })`) as Ref;
}

const decode = (uri: string) => Buffer.from(uri.split(",")[1]!, "base64");
async function meanPixelDiff(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([a, b].map(buf => sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  expect([y!.info.width, y!.info.height]).toEqual([x!.info.width, x!.info.height]);
  let sum = 0;
  for (let i = 0; i < x!.data.length; i++) sum += Math.abs(x!.data[i]! - y!.data[i]!);
  return sum / x!.data.length;
}

describe("AAJ Swift example built from plan.yaml matches the reference page", () => {
  const ref = referenceData();
  let tmp: string, built: Awaited<ReturnType<typeof build>>, page: any;
  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "bbp-ref-"));
    built = await build(join(EXAMPLE, "plan.yaml"), { out: join(tmp, "plan.html") });
    page = JSON.parse(readFileSync(built.out, "utf8").match(/<script id="plan-data" type="application\/json">([\s\S]*?)<\/script>/)![1]!);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("has the same sites, in the same order, with the same details", () => {
    expect(built.plan.sites.map(s => ({
      g: s.group, mv: s.mediaVehicle, lat: s.lat, lng: s.lng, loc: s.location, facing: s.facing, w: s.widthFt, h: s.heightFt,
      qty: s.qty, illum: s.illumination, rate: s.ratePerMonth, days: s.days,
      print: typeof s.printing === "number" ? s.printing : null, gstExtra: s.taxNote === "GST extra" || undefined
    }))).toEqual(ref.SITES.map(({ photos, ...s }) => ({ ...s, gstExtra: s.gstExtra })));
  });

  it("has the same groups, warehouse and rings", () => {
    expect(built.plan.groups.map(g => [g.id, g.name])).toEqual(Object.entries(ref.GROUPS).map(([id, g]) => [id, g.name]));
    const wh = built.plan.bases[0]!;
    expect([wh.name, wh.lat, wh.lng]).toEqual([ref.WAREHOUSE.name, ref.WAREHOUSE.lat, ref.WAREHOUSE.lng]);
    expect(built.plan.rings).toMatchObject({ center: { lat: ref.GURGAON.lat, lng: ref.GURGAON.lng, label: "Gurgaon" }, radiiKm: ref.RINGS_KM });
  });

  it("has the same city markers", () => {
    expect(built.plan.cities).toEqual(ref.CITIES);
  });

  it("gives the same distances from the warehouse (as shown, to 0.1 km)", () => {
    const wh = built.plan.bases[0]!;
    expect(built.plan.sites.map(s => haversineKm(wh, s).toFixed(1))).toEqual(ref.SITES.map(s => haversineKm(ref.WAREHOUSE, s).toFixed(1)));
  });

  it("gives the same totals: ₹4,66,000 + Binalo printing + GST", () => {
    const refTotal = ref.SITES.reduce((t, s) => t + s.rate + (s.print ?? 0), 0);
    const refArea = ref.SITES.reduce((t, s) => t + s.w * s.h * s.qty, 0);
    expect(built.totals).toEqual({ count: 8, area: refArea, rate: 388000, printing: 78000, total: refTotal, open: true });
    expect(refTotal).toBe(466000);
    expect(planTotals(built.plan.sites, built.plan.groups).groups.map(g => [g.area, g.total])).toEqual([[7800, 316000], [450, 150000]]);
  });

  it("shows each site's own photos, in order (same size, same picture)", async () => {
    expect(page.sites.map((s: any) => s.photos.length)).toEqual(ref.SITES.map(s => s.photos.length));
    for (const [i, s] of ref.SITES.entries()) {
      for (const [k, uri] of s.photos.entries()) {
        const diff = await meanPixelDiff(decode(uri), decode(page.sites[i].photos[k]));
        expect(diff, `site ${i + 1} photo ${k + 1}`).toBeLessThan(4);   // re-encoded JPEG, otherwise identical
      }
    }
  });

  it("uses the same logos", async () => {
    expect(await meanPixelDiff(decode(ref.LOGO), decode(page.logo))).toBeLessThan(2);
    expect(await meanPixelDiff(decode(ref.WH_LOGO), decode(page.bases[0].markerLogo))).toBeLessThan(2);
  });
});
