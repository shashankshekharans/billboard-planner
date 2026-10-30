import type { LatLng } from "./coords.js";

const R_KM = 6371;
const rad = (x: number) => x * Math.PI / 180;

/** Straight-line (great-circle) distance in km. Same formula as the generated page. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export interface Outlier { id: string; km: number; swapped: boolean }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Sites far from the rest, usually a typo in the coordinates. A point is an outlier when it is more
 * than max(minKm, factor × the median spread) from the median centre. `swapped` is true when
 * swapping its latitude and longitude would put it among the others.
 */
export function findOutliers<T extends LatLng & { id: string }>(points: T[], { minKm = 100, factor = 5 } = {}): Outlier[] {
  if (points.length < 3) return [];
  const centre = { lat: median(points.map(p => p.lat)), lng: median(points.map(p => p.lng)) };
  const limit = Math.max(minKm, factor * median(points.map(p => haversineKm(centre, p))));
  return points
    .map(p => ({ p, km: haversineKm(centre, p) }))
    .filter(({ km }) => km > limit)
    .map(({ p, km }) => {
      const canSwap = Math.abs(p.lng) <= 90;
      return { id: p.id, km, swapped: canSwap && haversineKm(centre, { lat: p.lng, lng: p.lat }) <= limit };
    });
}
