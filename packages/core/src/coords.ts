export interface LatLng { lat: number; lng: number }

/** A coordinate string that could not be read. `input` is the original value. */
export class CoordError extends Error {
  constructor(message: string, readonly input: unknown) {
    super(message);
    this.name = "CoordError";
  }
}

type Axis = "lat" | "lng";
interface Part { value: number; axis?: Axis }

// Typographic primes and quotes (Word, WhatsApp, GPS camera apps) become ' and ".
const normalise = (t: string) => t
  .replace(/[º˚]/g, "°")
  .replace(/[′’‘`´]/g, "'")
  .replace(/[″“”]/g, '"')
  .replace(/''/g, '"');

// One coordinate: optional label, then degrees with optional minutes and seconds, and a hemisphere letter
// either before the number ("N 28.1") or after it ("28.1 N") but not both, so "N 28.1 E 76.6" and
// `28°10'58"N 76°43'3"E` both split correctly.
const LABEL = String.raw`(?:\b(lat(?:itude)?|lng|lon(?:g(?:itude)?)?)\b\s*[:=]?\s*)?`;
const NUM = String.raw`([-+]?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*'\s*)?(?:(\d+(?:\.\d+)?)\s*"\s*)?`;
const PART = new RegExp(`${LABEL}(?:(?<![a-z])([nsew])\\s*${NUM}|${NUM}(?:([nsew])(?![a-z]))?)`, "gi");

// Google Maps links: ...?q=lat,lng or .../@lat,lng,17z
const GMAPS = /(?:[?&](?:q|query|ll)=|@)([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/;

const axisOfLabel = (label: string): Axis => label.toLowerCase().startsWith("lat") ? "lat" : "lng";
const axisOfHemi = (h: string): Axis => /[ns]/i.test(h) ? "lat" : "lng";

function readPart(m: RegExpMatchArray, input: unknown): Part {
  // Groups: 1 label | 2 hemisphere, 3-5 d/m/s (letter first) | 6-8 d/m/s, 9 hemisphere (letter after)
  const label = m[1];
  const [hemi, degText, minText, secText] = m[3] !== undefined ? [m[2], m[3], m[4], m[5]] : [m[9], m[6], m[7], m[8]];
  const deg = Number(degText);
  const min = minText ? Number(minText) : 0;
  const sec = secText ? Number(secText) : 0;
  if (min >= 60) throw new CoordError(`Minutes must be under 60 in "${m[0].trim()}"`, input);
  if (sec >= 60) throw new CoordError(`Seconds must be under 60 in "${m[0].trim()}"`, input);
  if (hemi && /^[-+]/.test(degText!)) throw new CoordError(`"${m[0].trim()}" has both a sign and a hemisphere letter`, input);

  let value = Math.abs(deg) + min / 60 + sec / 3600;
  if (minText || secText) value = Math.round(value * 1e6) / 1e6;   // converted values: 6 decimals (~10 cm), as vendors write them
  if (deg < 0 || (hemi && /[sw]/i.test(hemi))) value = -value;

  const byLabel = label ? axisOfLabel(label) : undefined;
  const byHemi = hemi ? axisOfHemi(hemi) : undefined;
  if (byLabel && byHemi && byLabel !== byHemi) throw new CoordError(`"${m[0].trim()}" is labelled ${byLabel} but has hemisphere ${hemi}`, input);
  return { value, axis: byLabel ?? byHemi };
}

function check({ lat, lng }: LatLng, input: unknown): LatLng {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new CoordError("Coordinates must be numbers", input);
  if (lat < -90 || lat > 90) throw new CoordError(`Latitude ${lat} is outside -90 to 90`, input);
  if (lng < -180 || lng > 180) throw new CoordError(`Longitude ${lng} is outside -180 to 180`, input);
  return { lat, lng };
}

/**
 * Read a latitude/longitude pair in any common vendor format:
 * "28.135394, 76.650181", "Lat 28.186815, Long 76.722692", "28.30119° 76.872404°",
 * `Lat 28°10'58.4895"N, Long 76°43'3.3067"E`, degrees + decimal minutes, N/S/E/W letters,
 * Google Maps links, a [lat, lng] array or a { lat, lng } object.
 * Without labels or hemisphere letters the first number is the latitude.
 * @throws CoordError when the input cannot be read or is out of range
 */
export function parseCoords(input: unknown): LatLng {
  if (Array.isArray(input) && input.length === 2) return check({ lat: Number(input[0]), lng: Number(input[1]) }, input);
  if (input && typeof input === "object" && "lat" in input && "lng" in input) {
    const o = input as { lat: unknown; lng: unknown };
    return check({ lat: Number(o.lat), lng: Number(o.lng) }, input);
  }
  if (typeof input !== "string") throw new CoordError("Coordinates must be text such as \"28.135394, 76.650181\"", input);

  const text = normalise(input.trim());
  const link = text.match(GMAPS);
  if (link) return check({ lat: Number(link[1]), lng: Number(link[2]) }, input);

  const parts = [...text.matchAll(PART)].map(m => readPart(m, input));
  if (!parts.length) throw new CoordError(`No coordinates found in "${input}"`, input);
  if (parts.length !== 2) throw new CoordError(`Expected two numbers (latitude and longitude), found ${parts.length} in "${input}"`, input);

  let [a, b] = parts as [Part, Part];
  if (a.axis && a.axis === b.axis) throw new CoordError(`"${input}" has two ${a.axis === "lat" ? "latitudes" : "longitudes"}`, input);
  if (a.axis === "lng" || b.axis === "lat") [a, b] = [b, a];
  return check({ lat: a.value, lng: b.value }, input);
}
