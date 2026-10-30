import type { PlanData, TileProvider } from "./model.js";
import type { PlanFile } from "./schema.js";

const coords = (p: { lat: number; lng: number }) => `${p.lat}, ${p.lng}`;
const tile = (p: TileProvider) => typeof p === "string" ? p : { url: p.url, ...(p.attribution && { attribution: p.attribution }), ...(p.maxZoom && { max_zoom: p.maxZoom }) };

/**
 * The plan file (plan.yaml shape) for resolved plan data, e.g. the data inside a page Billboard Planner built.
 * resolvePlan(planToFile(data)) gives the same data back. Images stay as they are (paths or data: URIs).
 */
export function planToFile(d: PlanData): PlanFile {
  return {
    plan: {
      title: d.title, subtitle: d.subtitle, ...(d.logo && { logo: d.logo }),
      currency: d.currency, locale: d.locale, theme: d.theme ?? "light",
      brand: { primary: d.brand.primary, ...(d.brand.accent && { accent: d.brand.accent }) },
      map: { default_view: d.map.defaultView, providers: { satellite: tile(d.map.providers.satellite), road: tile(d.map.providers.road) } },
      bases: d.bases.map(b => ({
        id: b.id, name: b.name, ...(b.label && { label: b.label }), ...(b.legendLabel && { legend_label: b.legendLabel }),
        coords: coords(b), ...(b.markerLogo && { marker_logo: b.markerLogo }), distance_from: !!b.distanceFrom
      })),
      ...(d.rings && { rings: { center: { coords: coords(d.rings.center), label: d.rings.center.label }, radii_km: d.rings.radiiKm, visible: d.rings.visible } }),
      ...(d.cities?.length && { cities: d.cities.map(c => ({ name: c.name, coords: coords(c) })) }),
      groups: d.groups.map(g => ({ id: g.id, name: g.name, color: g.color, ...(g.soft && { soft: g.soft }) })),
      notes: d.notes
    },
    sites: d.sites.map(s => ({
      id: s.id, group: s.group, media_vehicle: s.mediaVehicle, location: s.location, facing: s.facing, coords: coords(s),
      width_ft: s.widthFt, height_ft: s.heightFt, qty: s.qty, illumination: s.illumination,
      rate_per_month: s.ratePerMonth, days: s.days, printing: s.printing,
      ...(s.taxNote && { tax_note: s.taxNote }), ...(s.notes && { notes: s.notes }), photos: s.photos
    }))
  };
}
