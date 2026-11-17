// The resolved plan the page template renders (see packages/template/README.md).
// resolvePlan() turns a plan.yaml / plan.json into this shape.

export type Printing = number | "extra" | "tbc";
export type TileProvider = "esri-imagery" | "esri-street" | { url: string; attribution?: string; maxZoom?: number };

export interface SiteData {
  id: string;
  group: string;
  mediaVehicle: string;
  location: string;
  facing: string;
  lat: number;
  lng: number;
  widthFt: number;
  heightFt: number;
  qty: number;
  illumination: string;
  ratePerMonth: number;
  days: number;
  printing: Printing;
  taxNote?: string;
  notes?: string;
  photos: string[];
}

export interface BaseData {
  id: string;
  name: string;
  label?: string;
  legendLabel?: string;
  lat: number;
  lng: number;
  markerLogo?: string;
  distanceFrom?: boolean;
}

export interface GroupData { id: string; name: string; color: string; soft?: string }

export interface RingsData {
  center: { lat: number; lng: number; label: string };
  radiiKm: number[];
  visible: boolean;
}

/** Kinds of named place a plan can pin; each has its own marker colour on the page. */
export const PIN_KINDS = ["city", "store", "dealer", "competitor", "customer", "other"] as const;
export type PinKind = typeof PIN_KINDS[number];

/** A named place shown on the map for orientation (not a site or base): a city, a store, a competitor's board… */
export interface PinData { name: string; kind: PinKind; lat: number; lng: number }

export interface PlanData {
  title: string;
  subtitle: string;
  logo?: string;
  currency: string;
  locale: string;
  theme: "light" | "dark";
  brand: { primary: string; accent?: string };
  map: { defaultView: "satellite" | "road"; providers: { satellite: TileProvider; road: TileProvider } };
  bases: BaseData[];
  rings?: RingsData;
  pins?: PinData[];
  groups: GroupData[];
  notes: string[];
  sites: SiteData[];
}
