import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PlanError } from "@billboard-planner/core";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { AssetError, matchPhotos } from "./assets.js";
import { build, defaultOut } from "./build.js";
import { ReadError } from "./read.js";

const EXAMPLE = fileURLToPath(new URL("../../../examples/aaj-swift-nh48/", import.meta.url));
const FIXTURE = JSON.parse(readFileSync(new URL("../../template/test/fixtures/aaj-swift-nh48.json", import.meta.url), "utf8"));

const pageData = (html: string) => JSON.parse(html.match(/<script id="plan-data" type="application\/json">([\s\S]*?)<\/script>/)![1]!);
const withoutImages = (p: Record<string, any>) => ({
  ...p, logo: undefined, bases: p.bases.map((b: any) => ({ ...b, markerLogo: undefined })), sites: p.sites.map((s: any) => ({ ...s, photos: s.photos.length }))
});
const decode = (uri: string) => Buffer.from(uri.split(",")[1]!, "base64");

// The AAJ Swift sites as a vendor sheet (header names from real OOH sheets).
const VENDOR_HEADER = ["S.No", "Route", "Media Vehicle", "Location", "Fcg", "Lat Long", "Size", "Qty", "Illum.", "D.C.P.M", "Days", "Printing & Mounting", "GST"];
const vendorRows = () => FIXTURE.sites.map((s: any, i: number) => [
  s.id, FIXTURE.groups.find((g: any) => g.id === s.group).name, s.mediaVehicle, s.location, s.facing,
  i === 1 ? `Lat 28°10'58.4895"N, Long 76°43'3.3067"E` : `${s.lat}, ${s.lng}`,
  `${s.widthFt} x ${s.heightFt}`, s.qty, s.illumination, s.ratePerMonth, s.days,
  s.printing === "extra" ? "Extra" : s.printing, s.taxNote ?? ""
]);

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "bbp-"));
  cpSync(join(EXAMPLE, "photos"), join(tmp, "photos"), { recursive: true });
  cpSync(join(EXAMPLE, "logos"), join(tmp, "logos"), { recursive: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("build: AAJ Swift example from plan.yaml", () => {
  let html: string, result: Awaited<ReturnType<typeof build>>;
  beforeAll(async () => {
    result = await build(join(EXAMPLE, "plan.yaml"), { out: join(tmp, "aaj.html") });
    html = readFileSync(result.out, "utf8");
  });

  it("writes the reference plan data", () => {
    expect(withoutImages(pageData(html))).toEqual(withoutImages({ ...FIXTURE, theme: "light" }));
    expect(result.warnings).toEqual([]);
  });
  it("reports the reference totals", () => {
    expect(result.totals).toEqual({ count: 8, area: 8250, rate: 388000, printing: 78000, total: 466000, open: true });
  });
  it("embeds every image, so the file is self-contained", () => {
    const data = pageData(html);
    expect(data.sites.flatMap((s: any) => s.photos)).toHaveLength(10);
    expect(data.sites.flatMap((s: any) => s.photos).every((p: string) => p.startsWith("data:image/jpeg;base64,"))).toBe(true);
    expect(data.logo).toMatch(/^data:image\/png;base64,/);
    expect(data.bases[0].markerLogo).toMatch(/^data:image\/png;base64,/);
    expect(html).not.toMatch(/(src|href)="(photos|logos)\//);
  });
  it("keeps photos at most 1100 px and the file around 1 MB", async () => {
    for (const p of pageData(html).sites.flatMap((s: any) => s.photos)) {
      const m = await sharp(decode(p)).metadata();
      expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(1100);
    }
    expect(result.bytes).toBeLessThan(1.5 * 1024 * 1024);
  });
  it("keeps the logos' transparent background", async () => {
    const data = pageData(html);
    for (const uri of [data.logo, data.bases[0].markerLogo]) {
      const m = await sharp(decode(uri)).metadata();
      expect(m.hasAlpha).toBe(true);
      const { data: px } = await sharp(decode(uri)).raw().toBuffer({ resolveWithObject: true });
      expect(px[3]).toBe(0);   // top-left pixel is still transparent, not black
    }
  });
  it("defaults the output to plan.html next to the plan", () => {
    expect(defaultOut("examples/aaj-swift-nh48/plan.yaml")).toMatch(/[\\/]examples[\\/]aaj-swift-nh48[\\/]plan\.html$/);
  });
});

describe("build: spreadsheets", () => {
  it("a vendor XLSX with Plan and Groups sheets gives the same sites, totals and distances", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([VENDOR_HEADER, ...vendorRows(), ["", "", "", "Total", "", "", "", "", "", 388000]]), "Sites");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Setting", "Value"], ["Title", "Billboard Plan"], ["Logo", "logos/aaj-swift.png"],
      ["Base name", "AAJ Swift Warehouse"], ["Base coordinates", "28.24132198237465, 76.9355599373958"], ["Base label", "warehouse"],
      ["Base logo", "logos/aaj-mark.png"], ["Ring centre", "28.4595, 77.0266"], ["Ring label", "Gurgaon"], ["Ring radii (km)", "20, 50"]
    ]), "Plan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Group", "Colour"], ...FIXTURE.groups.map((g: any) => [g.name, g.color])]), "Groups");
    writeFileSync(join(tmp, "vendor.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const r = await build(join(tmp, "vendor.xlsx"));
    expect(r.out).toBe(join(tmp, "vendor.html"));
    expect(r.totals).toEqual({ count: 8, area: 8250, rate: 388000, printing: 78000, total: 466000, open: true });
    const yaml = await build(join(EXAMPLE, "plan.yaml"), { out: join(tmp, "y.html") });
    const strip = (s: any) => ({ ...s, group: undefined, photos: undefined });
    expect(r.plan.sites.map(strip)).toEqual(yaml.plan.sites.map(strip));
    expect(r.plan.rings).toEqual(yaml.plan.rings);
    expect(r.plan.sites.map(s => s.photos.length)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);   // no Photos column…
    const data = pageData(readFileSync(r.out, "utf8"));
    expect(data.sites.map((s: any) => s.photos.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 3]);   // …so photos/<id>*.jpg are used
    expect(r.warnings).toEqual(["Row 10 skipped: it looks like a total row."]);
  });

  it("a CSV of sites only builds with defaults and matched photos", async () => {
    const csv = [VENDOR_HEADER, ...vendorRows()].map(r => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    writeFileSync(join(tmp, "sites.csv"), "﻿" + csv);
    const r = await build(join(tmp, "sites.csv"));
    expect(r.plan.title).toBe("Billboard Plan");
    expect(r.plan.groups.map(g => g.name)).toEqual(["Delhi Jaipur Highway", "Binalo – Near Stella Showroom"]);
    expect(r.totals.total).toBe(466000);
    expect(pageData(readFileSync(r.out, "utf8")).sites[7].photos).toHaveLength(3);
  });

  it("a plan.yaml can take its sites from a CSV", async () => {
    writeFileSync(join(tmp, "with-sheet.yaml"), readFileSync(join(EXAMPLE, "plan.yaml"), "utf8").replace(/\nsites:[\s\S]*$/, "\nsites: sites.csv\n"));
    const r = await build(join(tmp, "with-sheet.yaml"));
    expect(r.plan.groups.map(g => g.id)).toEqual(["hwy", "binalo"]);
    expect(r.plan.sites.map(s => s.group)).toEqual(["hwy", "hwy", "hwy", "hwy", "hwy", "hwy", "hwy", "binalo"]);
    expect(r.plan.subtitle).toMatch(/Sample rates/);
    expect(r.warnings).toEqual([]);
  });
});

describe("build: problems", () => {
  it("lists missing photos", async () => {
    writeFileSync(join(tmp, "missing.yaml"), "plan: { groups: [{ id: a, name: A, color: '#000000' }] }\nsites:\n  - { id: 1, group: a, location: X, coords: '28.1, 76.6', width_ft: 1, height_ft: 1, rate_per_month: 1, photos: [photos/nope.jpg, photos/1.jpg] }\n");
    await expect(build(join(tmp, "missing.yaml"))).rejects.toThrow(AssetError);
    await expect(build(join(tmp, "missing.yaml"))).rejects.toThrow(/site 1 photos: photos\/nope\.jpg not found/);
  });
  it("reports plan problems", async () => {
    writeFileSync(join(tmp, "bad.yaml"), "plan: { groups: [{ id: a, name: A, color: green }] }\nsites: []\n");
    await expect(build(join(tmp, "bad.yaml"))).rejects.toThrow(PlanError);
  });
  it("rejects broken YAML and unknown file types", async () => {
    writeFileSync(join(tmp, "broken.yaml"), "plan: [unclosed\n");
    await expect(build(join(tmp, "broken.yaml"))).rejects.toThrow(ReadError);
    await expect(build(join(tmp, "plan.txt"))).rejects.toThrow(/use a .yaml/);
  });
  it("refuses to overwrite the plan file", async () => {
    await expect(build(join(EXAMPLE, "plan.yaml"), { out: join(EXAMPLE, "plan.yaml") })).rejects.toThrow(/overwrite/);
  });
});

describe("matchPhotos", () => {
  const files = ["1.jpg", "10.jpg", "1a.jpg", "8b.jpg", "8a.jpg", "8c.JPG", "binalo-day.jpg", "binalo-night.png", "notes.txt"];
  it("matches the id, id + letter and id-word, in order", () => {
    expect(matchPhotos("1", files)).toEqual(["1.jpg", "1a.jpg"]);
    expect(matchPhotos("8", files)).toEqual(["8a.jpg", "8b.jpg", "8c.JPG"]);
    expect(matchPhotos("binalo", files)).toEqual(["binalo-day.jpg", "binalo-night.png"]);
    expect(matchPhotos("10", files)).toEqual(["10.jpg"]);
  });
});
