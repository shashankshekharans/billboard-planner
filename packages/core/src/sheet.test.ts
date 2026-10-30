import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { resolvePlan } from "./resolve.js";
import { parseSize, sheetToPlan } from "./sheet.js";

const repo = new URL("../../../", import.meta.url);
const exampleYaml = () => parse(readFileSync(new URL("examples/aaj-swift-nh48/plan.yaml", repo), "utf8"));

// The AAJ Swift plan as a vendor would send it: OOH column names, size as "W x H", Indian-formatted money.
const VENDOR_ROWS = [
  { "S.No": 1, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Delhi Rd. Kasola Chowk Before Flyover", "Fcg": "Jaipur", "Lat Long": "28.135394, 76.650181", "Size (W x H)": "40 x 30", "Qty": 1, "Illum.": "N/L", "D.C.P.M": "36,000", "Days": 30, "Printing & Mounting": 12000, "Area (sq ft)": 1200, "Photos": "photos/1.jpg" },
  { "S.No": 2, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Delhi Rd – Agarwal Movers & Packers", "Fcg": "Delhi", "Lat Long": `Lat 28°10'58.4895"N, Long 76°43'3.3067"E`, "Size (W x H)": "40' X 20'", "Qty": 1, "Illum.": "N/L", "D.C.P.M": "₹24,000", "Days": 30, "Printing & Mounting": "8,000", "Photos": "photos/2.jpg" },
  { "S.No": 3, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Opp. N.H. Desi Hotel, Khijuri Agarwal Movers", "Fcg": "Jaipur", "Lat Long": "Lat 28.186815, Long 76.722692", "Size (W x H)": "40x20", "Qty": 1, "Illum.": "N/L", "D.C.P.M": "Rs. 24000", "Days": 30, "Printing & Mounting": 8000, "Photos": "photos/3.jpg" },
  { "S.No": 4, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Opp. N.H. Desi Hotel, Khijuri Agarwal Movers", "Fcg": "Delhi", "Lat Long": "28.187389, 76.723787", "Size (W x H)": "40*20", "Qty": 1, "Illum.": "N/L", "D.C.P.M": 24000, "Days": 30, "Printing & Mounting": 8000, "Photos": "photos/4.jpg" },
  { "S.No": 5, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Delhi Road – Dharuheda Rajwada", "Fcg": "Jaipur", "Lat Long": "28.204861, 76.767246", "Size (W x H)": "40 x 20 ft", "Qty": 1, "Illum.": "N/L", "D.C.P.M": 26000, "Days": 30, "Printing & Mounting": 8000, "Photos": "photos/5.jpg" },
  { "S.No": 6, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Delhi Road – Dharuheda", "Fcg": "Jaipur", "Lat Long": `Lat 28°13'12.8789"N, Long 76°47'47.5908"E`, "Size (W x H)": "80 x 30", "Qty": 1, "Illum.": "N/L", "D.C.P.M": 72000, "Days": 30, "Printing & Mounting": 24000, "Photos": "photos/6.jpg" },
  { "S.No": 7, "Route": "Delhi Jaipur Highway", "Media Vehicle": "Hoarding", "Location": "Delhi Road – Dharuhera", "Fcg": "Delhi", "Lat Long": "28.221989, 76.797893", "Size (W x H)": "50 x 20", "Qty": 1, "Illum.": "N/L", "D.C.P.M": 32000, "Days": 30, "Printing & Mounting": 10000, "Photos": "photos/7.jpg" },
  { "S.No": 8, "Route": "Binalo – Near Stella Showroom", "Media Vehicle": "Unipole", "Location": "Binalo – Near Stella Showroom", "Fcg": "", "Lat Long": "28.30119° 76.872404°", "Size (W x H)": "30 x 15", "Qty": 1, "Illum.": "", "D.C.P.M": "1,50,000", "Days": 30, "Printing & Mounting": "Extra", "GST": "GST extra", "Photos": "photos/8a.jpg; photos/8b.jpg; photos/8c.jpg" },
  { "S.No": "", "Route": "", "Location": "", "D.C.P.M": "3,88,000", "Area (sq ft)": 8250 }   // vendor's total row
];

describe("parseSize", () => {
  it.each([["40 x 30", [40, 30]], ["40' X 20'", [40, 20]], ["40x20", [40, 20]], ["40*20", [40, 20]], ["40 × 20 ft", [40, 20]], ["12.5 x 8", [12.5, 8]]])("%s", (t, wh) => {
    expect(parseSize(t)).toEqual(wh);
  });
  it("returns undefined for text it cannot read", () => expect(parseSize("large")).toBeUndefined());
});

describe("sheetToPlan: vendor sheet on its own", () => {
  const { file, warnings } = sheetToPlan({ sites: VENDOR_ROWS });

  it("maps OOH column names, sizes, money and photo lists", () => {
    expect(file.sites).toHaveLength(8);
    expect(file.sites[1]).toEqual({
      id: "2", group: "delhi-jaipur-highway", media_vehicle: "Hoarding", location: "Delhi Rd – Agarwal Movers & Packers",
      facing: "Delhi", coords: `Lat 28°10'58.4895"N, Long 76°43'3.3067"E`, width_ft: 40, height_ft: 20, qty: 1,
      illumination: "N/L", rate_per_month: 24000, days: 30, printing: 8000, photos: ["photos/2.jpg"]
    });
    expect(file.sites[7]).toMatchObject({ rate_per_month: 150000, printing: "Extra", tax_note: "GST extra", photos: ["photos/8a.jpg", "photos/8b.jpg", "photos/8c.jpg"] });
  });
  it("makes groups from the route column, in order, with colours", () => {
    expect(file.plan.groups).toEqual([
      { id: "delhi-jaipur-highway", name: "Delhi Jaipur Highway", color: "#0f6b3e" },
      { id: "binalo-near-stella-showroom", name: "Binalo – Near Stella Showroom", color: "#c27a06" }
    ]);
  });
  it("skips the vendor's total row and says so", () => {
    expect(warnings).toContain("Row 10 skipped: no location or coordinates (a total or blank row?).");
  });
  it("skips a row labelled Total or Grand Total that has no coordinates", () => {
    const { file, warnings } = sheetToPlan({ sites: [VENDOR_ROWS[0]!, { "S.No": "", "Location": "Grand Total", "D.C.P.M": 36000 }] });
    expect(file.sites).toHaveLength(1);
    expect(warnings).toContain("Row 3 skipped: it looks like a total row.");
  });
  it("keeps a real site that is missing coordinates, so resolvePlan reports it", () => {
    const { file } = sheetToPlan({ sites: [{ ...VENDOR_ROWS[0]!, "Lat Long": "" }] });
    expect(file.sites).toHaveLength(1);
    expect(() => resolvePlan(file)).toThrow(/coords .* or both lat and lng/);
  });
  it("resolves to the same totals as the example", () => {
    const { plan } = resolvePlan(file);
    expect(plan.sites.map(s => [s.lat, s.lng])).toEqual(resolvePlan(exampleYaml()).plan.sites.map(s => [s.lat, s.lng]));
  });
});

describe("sheetToPlan: settings and groups sheets", () => {
  const settings: [string, unknown][] = [
    ["Setting", "Value"],
    ["Title", "Billboard Plan"], ["Subtitle", "NH-48 corridor"], ["Logo", "logos/aaj-swift.png"],
    ["Currency", "INR"], ["Locale", "en-IN"], ["Brand colour", "#c1202d"],
    ["Base name", "AAJ Swift Warehouse"], ["Base coordinates", "28.24132198237465, 76.9355599373958"],
    ["Base label", "warehouse"], ["Base logo", "logos/aaj-mark.png"],
    ["Ring centre", "28.4595, 77.0266"], ["Ring label", "Gurgaon"], ["Ring radii (km)", "20, 50"], ["Show rings", "Yes"],
    ["Note", "Printing is one-time."], ["Note", "Distances are straight-line."], ["", ""]
  ];
  const groups = [{ Group: "Delhi Jaipur Highway", Colour: "#0f6b3e" }, { Group: "Binalo – Near Stella Showroom", Colour: "#c27a06" }];
  const { file } = sheetToPlan({ sites: VENDOR_ROWS, settings, groups });

  it("reads plan settings", () => {
    expect(file.plan).toMatchObject({
      title: "Billboard Plan", subtitle: "NH-48 corridor", logo: "logos/aaj-swift.png", currency: "INR", locale: "en-IN",
      brand: { primary: "#c1202d" },
      bases: [{ id: "base", name: "AAJ Swift Warehouse", coords: "28.24132198237465, 76.9355599373958", label: "warehouse", marker_logo: "logos/aaj-mark.png", distance_from: true }],
      rings: { center: { coords: "28.4595, 77.0266", label: "Gurgaon" }, radii_km: [20, 50], visible: true },
      notes: ["Printing is one-time.", "Distances are straight-line."]
    });
  });
  it("rings can be centred on the base", () => {
    const { file } = sheetToPlan({ sites: VENDOR_ROWS, settings: [["Base name", "WH"], ["Base coordinates", "28.2, 76.9"], ["Ring centre", "base"], ["Ring radii", "10"]] });
    expect(file.plan.rings).toEqual({ center: { base: "base" }, radii_km: [10], visible: true });
  });
  it("uses the groups sheet's colours", () => {
    expect(file.plan.groups.map(g => g.color)).toEqual(["#0f6b3e", "#c27a06"]);
  });
  it("reports unknown settings", () => {
    const { warnings } = sheetToPlan({ sites: VENDOR_ROWS, settings: [["Titel", "x"]] });
    expect(warnings).toContain('Unknown setting "Titel" ignored.');
  });
});

describe("sheetToPlan: inside a plan.yaml", () => {
  it("maps group names or ids to the plan's groups and keeps its settings", () => {
    const base = exampleYaml();
    const rows = VENDOR_ROWS.map(r => ({ ...r, Route: r.Route === "Delhi Jaipur Highway" ? "hwy" : r.Route }));
    const { file, warnings } = sheetToPlan({ sites: rows }, base.plan);
    expect(file.plan).toBe(base.plan);
    expect(file.sites.map(s => s.group)).toEqual(["hwy", "hwy", "hwy", "hwy", "hwy", "hwy", "hwy", "binalo"]);
    expect(warnings.filter(w => !w.startsWith("Row 10"))).toEqual([]);
  });
  it("adds a group the plan does not have, with a warning", () => {
    const base = exampleYaml();
    const { file, warnings } = sheetToPlan({ sites: [{ ...VENDOR_ROWS[0]!, Route: "Sohna Road" }] }, base.plan);
    expect(file.plan.groups.at(-1)).toMatchObject({ id: "sohna-road", name: "Sohna Road" });
    expect(warnings).toContain('Group "Sohna Road" is not in the plan; added it with colour ' + file.plan.groups.at(-1)!.color + ".");
  });
});

describe("sheetToPlan: other column shapes", () => {
  it("separate width/height and lat/long columns; ids from row numbers; one default group", () => {
    const { file } = sheetToPlan({ sites: [{ Site: "Board", Width: 20, Height: 10, Latitude: "12.97", Longitude: 77.59, "Monthly rate": "50000" }] });
    expect(file.sites[0]).toMatchObject({ id: "1", group: "sites", location: "Board", width_ft: 20, height_ft: 10, coords: "Lat 12.97, Long 77.59", rate_per_month: 50000 });
    expect(file.plan.groups).toEqual([{ id: "sites", name: "Sites", color: "#0f6b3e" }]);
  });
  it("lists columns it does not recognise", () => {
    const { warnings } = sheetToPlan({ sites: [{ Location: "A", Coordinates: "1, 2", Width: 1, Height: 1, Rate: 1, Vendor: "X", Traffic: "high" }] });
    expect(warnings).toContain("Columns not used: Vendor, Traffic.");
  });
});

describe("sheetToPlan: City setting", () => {
  it("reads City rows as Name: coordinates", () => {
    const { file, warnings } = sheetToPlan({ sites: VENDOR_ROWS, settings: [["City", "Gurgaon: 28.4595, 77.0266"], ["City", "Manesar = Lat 28.3540, Long 76.9395"], ["City", "28.1, 76.2"]] });
    expect(file.plan.cities).toEqual([{ name: "Gurgaon", coords: "28.4595, 77.0266" }, { name: "Manesar", coords: "Lat 28.3540, Long 76.9395" }]);
    expect(warnings.some(w => w.startsWith('City "28.1, 76.2" ignored'))).toBe(true);
  });
  it("accepts several cities in one cell, separated by ;", () => {
    const { file } = sheetToPlan({ sites: VENDOR_ROWS, settings: [["Cities", "Gurgaon: 28.4595, 77.0266; Manesar: 28.3540, 76.9395"]] });
    expect(file.plan.cities).toEqual([{ name: "Gurgaon", coords: "28.4595, 77.0266" }, { name: "Manesar", coords: "28.3540, 76.9395" }]);
  });
});
