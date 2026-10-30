import { z } from "zod";

// Schema for a plan file (plan.yaml / plan.json), as written by people: snake_case, defaults filled in.
// Objects are strict so a misspelt key ("widht_ft") is reported instead of silently ignored.

const hex = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, "Use a hex colour such as #0f6b3e");
const text = z.string().trim();
const id = z.union([z.string().trim().min(1), z.number()]).transform(String);
const positive = z.number().positive();
const latLng = { lat: z.number().optional(), lng: z.number().optional() };

/** Any supported coordinate form; parsed later by parseCoords. */
const coords = z.union([z.string(), z.tuple([z.number(), z.number()]), z.object({ lat: z.number(), lng: z.number() })]);
const hasPosition = (o: { coords?: unknown; lat?: number; lng?: number }) => o.coords !== undefined || (o.lat !== undefined && o.lng !== undefined);
const positionMessage = { message: "Give either coords (any format) or both lat and lng" };

// "Extra", "TBC", "To be confirmed" and similar are accepted in any case.
const printing = z.preprocess(
  v => typeof v === "string" ? ({ extra: "extra", tbc: "tbc", "to be confirmed": "tbc", tba: "tbc" } as Record<string, string>)[v.trim().toLowerCase()] ?? v : v,
  z.union([z.number().nonnegative(), z.literal("extra"), z.literal("tbc")], { error: 'Use a number, "extra" or "tbc"' })
);

const tileProvider = z.union([
  z.enum(["esri-imagery", "esri-street"]),
  z.strictObject({ url: z.string().url(), attribution: text.optional(), max_zoom: z.number().int().min(1).max(24).optional() })
]);

export const siteSchema = z.strictObject({
  id,
  group: text.min(1),
  media_vehicle: text.default(""),
  location: text.min(1, "Location is required"),
  facing: text.default(""),
  coords: coords.optional(),
  ...latLng,
  width_ft: positive,
  height_ft: positive,
  qty: z.number().int().positive().default(1),
  illumination: text.default(""),
  rate_per_month: z.number().nonnegative(),
  days: z.number().int().positive().default(30),
  printing: printing.default("tbc"),
  tax_note: text.nullish(),
  notes: text.nullish(),
  photos: z.array(text.min(1)).default([])
}).refine(hasPosition, positionMessage);

export const baseSchema = z.strictObject({
  id,
  name: text.min(1),
  label: text.optional(),
  legend_label: text.optional(),
  coords: coords.optional(),
  ...latLng,
  marker_logo: text.optional(),
  distance_from: z.boolean().default(false)
}).refine(hasPosition, positionMessage);

const ringCenter = z.union([
  z.strictObject({ base: id, label: text.optional() }),
  z.strictObject({ coords: coords.optional(), ...latLng, label: text.optional() }).refine(hasPosition, positionMessage)
]);

export const planSchema = z.strictObject({
  plan: z.strictObject({
    title: text.default("Billboard Plan"),
    subtitle: text.default(""),
    logo: text.optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code such as INR").transform(s => s.toUpperCase()).default("INR"),
    locale: text.default("en-IN"),
    theme: z.enum(["light", "dark"]).default("light"),
    brand: z.strictObject({ primary: hex.default("#c1202d"), accent: hex.optional() }).prefault({}),
    map: z.strictObject({
      default_view: z.enum(["satellite", "road"]).default("satellite"),
      providers: z.strictObject({ satellite: tileProvider.default("esri-imagery"), road: tileProvider.default("esri-street") }).prefault({})
    }).prefault({}),
    bases: z.array(baseSchema).default([]),
    rings: z.strictObject({
      center: ringCenter,
      radii_km: z.array(positive).min(1),
      visible: z.boolean().default(true)
    }).optional(),
    cities: z.array(z.strictObject({ name: text.min(1), coords: coords.optional(), ...latLng }).refine(hasPosition, positionMessage)).default([]),
    groups: z.array(z.strictObject({ id, name: text.min(1), color: hex, soft: hex.optional() })).min(1, "Add at least one group"),
    notes: z.array(text).default([])
  }),
  sites: z.array(siteSchema).min(1, "Add at least one site")
});

export type PlanFile = z.input<typeof planSchema>;
export type ParsedPlanFile = z.output<typeof planSchema>;
