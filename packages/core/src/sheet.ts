// Turn spreadsheet rows (CSV or XLSX, read by the CLI) into a plan file object for resolvePlan.
// Vendor sheets name columns many ways ("D.C.P.M", "Fcg", "Lat Long", "Size (W x H)"); headers are matched
// after lower-casing and dropping everything but letters and digits.

type Row = Record<string, unknown>;
type SiteField = "id" | "group" | "media_vehicle" | "location" | "facing" | "coords" | "lat" | "lng" | "size" | "width_ft" |
  "height_ft" | "qty" | "illumination" | "rate_per_month" | "days" | "printing" | "tax_note" | "notes" | "photos";

const key = (h: string) => h.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

const SITE_ALIASES: Record<SiteField, string[]> = {
  id: ["id", "siteid", "siteno", "no", "sno", "srno", "slno", "serialno", "#", "code", "sitecode"],
  group: ["group", "route", "zone", "cluster", "corridor", "region", "routegroup"],
  media_vehicle: ["mediavehicle", "media", "mediatype", "type", "format", "vehicle"],
  location: ["location", "site", "sitename", "address", "description", "locationdescription"],
  facing: ["facing", "fcg", "faces", "direction", "facingdirection"],
  coords: ["coords", "coordinates", "latlong", "latlng", "latlon", "gps", "gpscoordinates", "geocoordinates", "maplink", "googlemaps", "googlemapslink", "location coordinates"],
  lat: ["lat", "latitude"],
  lng: ["long", "lng", "lon", "longitude"],
  size: ["size", "sizeft", "sizewxh", "sizewxhft", "dimensions", "dimension", "sizeinft"],
  width_ft: ["width", "widthft", "w", "wft", "widthinft"],
  height_ft: ["height", "heightft", "h", "hft", "heightinft"],
  qty: ["qty", "quantity", "nos", "units", "noofunits"],
  illumination: ["illumination", "illum", "lit", "lighting", "litnl", "litnonlit"],
  rate_per_month: ["ratepermonth", "rate", "dcpm", "displaycostpermonth", "monthlyrate", "monthlyrent", "rent", "rental", "costpermonth", "cardrate", "rentpermonth", "displaycost"],
  days: ["days", "duration", "durationdays", "period", "noofdays"],
  printing: ["printing", "printingandmounting", "pandm", "pm", "mounting", "printingcost", "flex", "printingmounting"],
  tax_note: ["taxnote", "tax", "gst", "gstnote"],
  notes: ["notes", "note", "remarks", "remark", "comments", "comment"],
  photos: ["photos", "photo", "images", "image", "photofiles", "photofile", "pictures"]
};
const ALIAS = new Map<string, SiteField>(Object.entries(SITE_ALIASES).flatMap(([f, as]) => as.map(a => [key(a), f as SiteField])));
// Columns that vendors add but the planner computes itself: ignored without a warning.
const COMPUTED = /^(area|totalarea|areasqft|sqft|total|totalcost|totalamount|amount|totalfor30days|grandtotal|subtotal|gstamount|distance)/;

export const GROUP_PALETTE = ["#0f6b3e", "#c27a06", "#1f5fa8", "#8e3b9e", "#b23a3a", "#2a7f8a", "#6b6b1f", "#444f5a"];

const slug = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
const cellText = (v: unknown) => v === null || v === undefined ? "" : String(v).trim();
const isBlank = (v: unknown) => cellText(v) === "";

/** "40 x 30", "40' X 20'", "40*20", "40 × 20 ft" → [40, 30] */
export function parseSize(t: string): [number, number] | undefined {
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

// "₹1,50,000", "Rs. 24000", "36,000" → number. Text such as "Extra" is kept for the schema to read or reject.
function money(v: unknown): unknown {
  if (typeof v === "number" || isBlank(v)) return isBlank(v) ? undefined : v;
  const t = cellText(v);
  const n = t.replace(/^(?:rs\.?|inr|₹|\$|€|£)\s*/i, "").replace(/[,\s]/g, "").replace(/\/-$/, "");
  return /^-?\d+(?:\.\d+)?$/.test(n) ? Number(n) : t;
}
const number = (v: unknown) => {
  if (typeof v === "number" || isBlank(v)) return isBlank(v) ? undefined : v;
  const n = Number(cellText(v).replace(/,/g, "").replace(/\s*(?:ft|feet|'|days?)$/i, ""));
  return Number.isNaN(n) ? cellText(v) : n;
};

export interface GroupInput { id: string; name: string; color: string; soft?: string }
export interface SheetInput {
  /** One object per row, keyed by header (as CSV/XLSX readers return them). */
  sites: Row[];
  /** "Plan" sheet: [setting, value] rows. */
  settings?: unknown[][];
  /** "Groups" sheet: rows with a group name and colour. */
  groups?: Row[];
}
type PlanObject = Record<string, unknown> & { groups: GroupInput[] };
type SiteObject = Record<string, unknown> & { id: string; group: string };

/**
 * Build a plan file from spreadsheet rows.
 * @param input sites rows, plus optional settings and groups sheets
 * @param plan the `plan:` section of a plan.yaml that points at this sheet; its settings and groups win
 * @returns the plan file object (pass it to resolvePlan) and warnings about rows and columns
 */
export function sheetToPlan(input: SheetInput, plan?: Record<string, unknown>): { file: { plan: PlanObject; sites: SiteObject[] }; warnings: string[] } {
  const warnings: string[] = [];
  const planObj = (plan ?? settingsToPlan(input.settings ?? [], warnings)) as PlanObject;
  const groups: GroupInput[] = Array.isArray(planObj.groups) ? planObj.groups : [];
  if (!plan) {
    planObj.groups = groups;
    for (const r of input.groups ?? []) {
      const cols = Object.entries(r).map(([h, v]) => [key(h), cellText(v)] as const);
      const name = cols.find(([h]) => ["group", "name", "route", "groupname"].includes(h))?.[1];
      const color = cols.find(([h]) => ["colour", "color", "groupcolour", "groupcolor"].includes(h))?.[1];
      if (name) groups.push({ id: slug(name), name, color: color || GROUP_PALETTE[groups.length % GROUP_PALETTE.length]! });
    }
  }

  // Which column feeds which field
  const headers = [...new Set(input.sites.flatMap(r => Object.keys(r)))];
  const col = new Map<SiteField, string>();
  const unused: string[] = [];
  for (const h of headers) {
    const f = ALIAS.get(key(h));
    if (f && !col.has(f)) col.set(f, h);
    else if (!f && !COMPUTED.test(key(h)) && key(h)) unused.push(h);
  }
  if (unused.length) warnings.push(`Columns not used: ${unused.join(", ")}.`);

  const groupFor = (name: string): string => {
    const label = name || "Sites";
    const found = groups.find(g => g.id === label) ?? groups.find(g => g.name.toLowerCase() === label.toLowerCase());
    if (found) return found.id;
    const g = { id: slug(label), name: label, color: GROUP_PALETTE[groups.length % GROUP_PALETTE.length]! };
    groups.push(g);
    if (plan) warnings.push(`Group "${label}" is not in the plan; added it with colour ${g.color}.`);
    return g.id;
  };

  const sites: SiteObject[] = [];
  input.sites.forEach((r, i) => {
    const get = (f: SiteField) => col.has(f) ? r[col.get(f)!] : undefined;
    const rowNo = i + 2;   // header is row 1
    const location = cellText(get("location"));
    const hasPos = !isBlank(get("coords")) || (!isBlank(get("lat")) && !isBlank(get("lng")));
    if (!location && !hasPos) {
      if (Object.values(r).some(v => !isBlank(v))) warnings.push(`Row ${rowNo} skipped: no location or coordinates (a total or blank row?).`);
      return;
    }
    if (!hasPos && Object.values(r).some(v => /^(grand\s*|sub\s*-?\s*)?totals?\b/i.test(cellText(v)))) {
      warnings.push(`Row ${rowNo} skipped: it looks like a total row.`);
      return;
    }
    const s: SiteObject = { id: cellText(get("id")) || String(sites.length + 1), group: groupFor(cellText(get("group"))) };
    const put = (k: string, v: unknown) => { if (v !== undefined && v !== "") s[k] = v; };
    put("media_vehicle", cellText(get("media_vehicle")));
    put("location", location);
    put("facing", cellText(get("facing")));
    if (!isBlank(get("coords"))) put("coords", cellText(get("coords")));
    else if (hasPos) put("coords", `Lat ${cellText(get("lat"))}, Long ${cellText(get("lng"))}`);
    const size = col.has("size") ? parseSize(cellText(get("size"))) : undefined;
    put("width_ft", number(get("width_ft")) ?? size?.[0] ?? (col.has("size") ? cellText(get("size")) : undefined));
    put("height_ft", number(get("height_ft")) ?? size?.[1]);
    put("qty", number(get("qty")));
    put("illumination", cellText(get("illumination")));
    put("rate_per_month", money(get("rate_per_month")));
    put("days", number(get("days")));
    put("printing", money(get("printing")));
    put("tax_note", cellText(get("tax_note")));
    put("notes", cellText(get("notes")));
    const photos = cellText(get("photos")).split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    if (photos.length) s.photos = photos;
    sites.push(s);
  });

  return { file: { plan: planObj, sites }, warnings };
}

// "Plan" sheet: two columns, setting and value. Base and ring settings build plan.bases[0] and plan.rings.
function settingsToPlan(rows: unknown[][], warnings: string[]): Record<string, unknown> {
  const plan: Record<string, unknown> = {};
  const base: Record<string, unknown> = {};
  const rings: Record<string, unknown> = {};
  const center: Record<string, unknown> = {};
  const notes: string[] = [];
  const cities: { name: string; coords: string }[] = [];
  const yes = (v: string) => /^(y|yes|true|1|show|on)$/i.test(v);
  for (const [k, v] of rows) {
    const name = cellText(k), value = cellText(v);
    if (!name || !value || ["setting", "settings"].includes(key(name))) continue;
    switch (key(name)) {
      case "title": case "plantitle": plan.title = value; break;
      case "subtitle": plan.subtitle = value; break;
      case "logo": case "companylogo": plan.logo = value; break;
      case "currency": plan.currency = value; break;
      case "locale": plan.locale = value; break;
      case "theme": plan.theme = value.toLowerCase(); break;
      case "brandcolour": case "brandcolor": case "brand": plan.brand = { ...(plan.brand as object), primary: value }; break;
      case "accentcolour": case "accentcolor": plan.brand = { ...(plan.brand as object), accent: value }; break;
      case "defaultview": case "mapview": plan.map = { default_view: /road|map|street/i.test(value) ? "road" : "satellite" }; break;
      case "basename": case "warehouse": case "warehousename": base.name = value; break;
      case "basecoordinates": case "basecoords": case "baselocation": case "warehousecoordinates": base.coords = value; break;
      case "baselabel": base.label = value; break;
      case "baselegend": case "baselegendlabel": base.legend_label = value; break;
      case "baselogo": case "markerlogo": base.marker_logo = value; break;
      case "distancefrombase": base.distance_from = yes(value); break;
      case "ringcentre": case "ringcenter":
        if (/^base$/i.test(value)) center.base = "base"; else center.coords = value;
        break;
      case "ringlabel": center.label = value; break;
      case "ringradii": case "ringradiikm": case "rings": case "ringskm":
        rings.radii_km = value.split(/[,;\s]+/).filter(Boolean).map(Number);
        break;
      case "showrings": rings.visible = yes(value); break;
      case "city": case "cities": case "town": case "citymarker": {
        // "Manesar: 28.3540, 76.9395". Several cities: one row each, or separated by ;
        for (const part of value.split(/\s*;\s*(?=[^\d\s-])/)) {
          const m = part.match(/^([^:\d][^:]*?)\s*[:=]\s*(.+)$/);
          if (m) cities.push({ name: m[1]!.trim(), coords: m[2]!.trim() });
          else warnings.push(`City "${part}" ignored: write it as Name: coordinates, e.g. Manesar: 28.3540, 76.9395.`);
        }
        break;
      }
      case "note": case "notes": notes.push(...value.split(/\n+/).map(t => t.trim()).filter(Boolean)); break;
      default: warnings.push(`Unknown setting "${name}" ignored.`);
    }
  }
  if (Object.keys(base).length) plan.bases = [{ id: "base", ...base, distance_from: base.distance_from ?? true }];
  if (rings.radii_km || Object.keys(center).length) {
    if (center.base && center.label === undefined) delete center.label;
    plan.rings = { center, radii_km: rings.radii_km ?? [], visible: rings.visible ?? true };
  }
  if (notes.length) plan.notes = notes;
  if (cities.length) plan.cities = cities;
  return plan;
}
