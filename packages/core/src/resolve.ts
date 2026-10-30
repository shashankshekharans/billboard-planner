import { CoordError, parseCoords, type LatLng } from "./coords.js";
import { findOutliers } from "./geo.js";
import type { BaseData, PlanData, SiteData, TileProvider } from "./model.js";
import { planSchema, type ParsedPlanFile } from "./schema.js";

/** A plan file with problems. `issues` holds one readable line per problem. */
export class PlanError extends Error {
  constructor(readonly issues: string[]) {
    super(`The plan has ${issues.length} problem${issues.length > 1 ? "s" : ""}:\n- ${issues.join("\n- ")}`);
    this.name = "PlanError";
  }
}

type Path = PropertyKey[];

// "sites[3].width_ft (site 4)" reads better than ["sites", 3, "width_ft"].
function where(path: Path, input: unknown): string {
  let out = "";
  for (const k of path) out += typeof k === "number" ? `[${k}]` : (out ? "." : "") + String(k);
  if (path[0] === "sites" && typeof path[1] === "number") {
    const site = (input as { sites?: { id?: unknown }[] })?.sites?.[path[1]];
    if (site?.id !== undefined) out += ` (site ${site.id})`;
  }
  return out || "plan file";
}

const tile = (p: ParsedPlanFile["plan"]["map"]["providers"]["road"]): TileProvider =>
  typeof p === "string" ? p : { url: p.url, ...(p.attribution && { attribution: p.attribution }), ...(p.max_zoom && { maxZoom: p.max_zoom }) };

/**
 * Check a plan file and turn it into the data the page template renders.
 * Coordinates in any supported format become decimal lat/lng. Photo and logo paths are kept as written
 * (the build step embeds them).
 * @param input the parsed YAML or JSON
 * @returns the plan data and warnings worth showing the user (nothing fatal)
 * @throws PlanError listing every problem found
 */
export function resolvePlan(input: unknown): { plan: PlanData; warnings: string[] } {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) throw new PlanError(parsed.error.issues.map(i => `${where(i.path, input)}: ${i.message}`));
  const { plan: p, sites } = parsed.data;
  const issues: string[] = [];
  const warnings: string[] = [];

  const position = (o: { coords?: unknown; lat?: number; lng?: number }, path: Path): LatLng => {
    try { return parseCoords(o.coords ?? { lat: o.lat, lng: o.lng }); }
    catch (e) {
      if (!(e instanceof CoordError)) throw e;
      issues.push(`${where([...path, o.coords !== undefined ? "coords" : "lat"], input)}: ${e.message}`);
      return { lat: 0, lng: 0 };
    }
  };
  const dupes = (ids: string[], what: string, path: string) => ids.forEach((v, i) => {
    if (ids.indexOf(v) !== i) issues.push(`${path}[${i}].id: ${what} id "${v}" is used more than once`);
  });

  dupes(p.groups.map(g => g.id), "Group", "plan.groups");
  dupes(p.bases.map(b => b.id), "Base", "plan.bases");
  dupes(sites.map(s => s.id), "Site", "sites");

  const bases: BaseData[] = p.bases.map((b, i) => ({
    id: b.id, name: b.name,
    ...(b.label && { label: b.label }), ...(b.legend_label && { legendLabel: b.legend_label }),
    ...position(b, ["plan", "bases", i]),
    ...(b.marker_logo && { markerLogo: b.marker_logo }),
    distanceFrom: b.distance_from
  }));
  if (bases.filter(b => b.distanceFrom).length > 1) warnings.push("More than one base has distance_from: true; distances use the first one.");

  let rings: PlanData["rings"];
  if (p.rings) {
    const c = p.rings.center;
    let center: LatLng & { label: string } | undefined;
    if ("base" in c) {
      const b = bases.find(x => x.id === c.base);
      if (!b) issues.push(`plan.rings.center.base: there is no base with id "${c.base}"`);
      else center = { lat: b.lat, lng: b.lng, label: c.label ?? b.label ?? b.name };
    } else {
      center = { ...position(c, ["plan", "rings", "center"]), label: c.label ?? "centre" };
    }
    if (center) rings = { center, radiiKm: p.rings.radii_km, visible: p.rings.visible };
  }

  const cities = p.cities.map((c, i) => ({ name: c.name, ...position(c, ["plan", "cities", i]) }));

  const groupIds = new Set(p.groups.map(g => g.id));
  const siteData: SiteData[] = sites.map((s, i) => {
    if (!groupIds.has(s.group)) issues.push(`${where(["sites", i, "group"], input)}: there is no group with id "${s.group}" (groups: ${[...groupIds].join(", ")})`);
    return {
      id: s.id, group: s.group, mediaVehicle: s.media_vehicle, location: s.location, facing: s.facing,
      ...position(s, ["sites", i]),
      widthFt: s.width_ft, heightFt: s.height_ft, qty: s.qty, illumination: s.illumination,
      ratePerMonth: s.rate_per_month, days: s.days, printing: s.printing,
      ...(s.tax_note && { taxNote: s.tax_note }), ...(s.notes && { notes: s.notes }),
      photos: s.photos
    };
  });
  if (issues.length) throw new PlanError(issues);

  for (const g of p.groups) if (!siteData.some(s => s.group === g.id)) warnings.push(`Group "${g.name}" has no sites.`);
  for (const o of findOutliers(siteData)) {
    const s = siteData.find(x => x.id === o.id)!;
    warnings.push(`Site ${o.id} (${s.location}) is ${Math.round(o.km)} km from the other sites.` +
      (o.swapped ? " Latitude and longitude look swapped." : " Check its coordinates."));
  }

  return {
    plan: {
      title: p.title, subtitle: p.subtitle, ...(p.logo && { logo: p.logo }),
      currency: p.currency, locale: p.locale, theme: p.theme,
      brand: { primary: p.brand.primary, ...(p.brand.accent && { accent: p.brand.accent }) },
      map: { defaultView: p.map.default_view, providers: { satellite: tile(p.map.providers.satellite), road: tile(p.map.providers.road) } },
      bases, ...(rings && { rings }), ...(cities.length && { cities }),
      groups: p.groups.map(g => ({ id: g.id, name: g.name, color: g.color, ...(g.soft && { soft: g.soft }) })),
      notes: p.notes,
      sites: siteData
    },
    warnings
  };
}
