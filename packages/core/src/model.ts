// The resolved plan the page template renders (see packages/template/README.md).
// resolvePlan() turns a plan.yaml / plan.json into this shape.

export type Printing = number | "extra" | "tbc";
export type TileProvider = string | { url: string; attribution?: string; maxZoom?: number };

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
  groups: GroupData[];
  notes: string[];
  sites: SiteData[];
}
