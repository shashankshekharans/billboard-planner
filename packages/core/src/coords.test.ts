import { describe, expect, it } from "vitest";
import { CoordError, parseCoords } from "./coords.js";

const near = (text: string, lat: number, lng: number) => {
  const c = parseCoords(text);
  expect(c.lat).toBeCloseTo(lat, 6);
  expect(c.lng).toBeCloseTo(lng, 6);
};

describe("parseCoords: vendor formats from the AAJ Swift sheet", () => {
  it("plain decimal pair", () => near("28.135394, 76.650181", 28.135394, 76.650181));
  it("Lat … Long … labels", () => near("Lat 28.186815, Long 76.722692", 28.186815, 76.722692));
  it("decimal with degree signs", () => near("28.30119° 76.872404°", 28.30119, 76.872404));
  it("DMS with labels and hemispheres (site 2)", () => near(`Lat 28°10'58.4895"N, Long 76°43'3.3067"E`, 28.182914, 76.717585));
  it("DMS with labels and hemispheres (site 6)", () => near(`Lat 28°13'12.8789"N, Long 76°47'47.5908"E`, 28.220244, 76.796553));
});

describe("parseCoords: other common forms", () => {
  it("no space after the comma", () => near("28.135394,76.650181", 28.135394, 76.650181));
  it("space only", () => near("28.135394 76.650181", 28.135394, 76.650181));
  it("semicolon", () => near("28.135394; 76.650181", 28.135394, 76.650181));
  it("full labels with colons", () => near("Latitude: 28.1, Longitude: 76.6", 28.1, 76.6));
  it("lng / lon labels", () => {
    near("lat 28.1 lng 76.6", 28.1, 76.6);
    near("lat=28.1 lon=76.6", 28.1, 76.6);
  });
  it("labels in the other order", () => near("Long 76.722692, Lat 28.186815", 28.186815, 76.722692));
  it("hemisphere letters after the number", () => near("28.1 N, 76.6 E", 28.1, 76.6));
  it("hemisphere letters before the number", () => near("N 28.1 E 76.6", 28.1, 76.6));
  it("south and west are negative", () => {
    near("33.8688° S, 151.2093° E", -33.8688, 151.2093);
    near("40.7128 N, 74.0060 W", 40.7128, -74.006);
  });
  it("negative decimals", () => near("-33.8688, -70.5", -33.8688, -70.5));
  it("hemisphere letters put longitude first", () => near("76.6 E, 28.1 N", 28.1, 76.6));
  it("DMS with typographic primes and º", () => near("28º10′58.4895″N 76º43′3.3067″E", 28.182914, 76.717585));
  it("DMS with curly quotes from Word or WhatsApp", () => near("28°10’58.4895” N, 76°43’3.3067” E", 28.182914, 76.717585));
  it("DMS with '' for seconds", () => near("28°10'58.4895''N 76°43'3.3067''E", 28.182914, 76.717585));
  it("degrees and decimal minutes", () => near("28°10.9748' N, 76°43.0551' E", 28.182913, 76.717585));
  it("surrounding whitespace and a trailing full stop", () => near("  28.135394, 76.650181. ", 28.135394, 76.650181));
  it("a Google Maps link", () => {
    near("https://www.google.com/maps?q=28.135394,76.650181", 28.135394, 76.650181);
    near("https://www.google.com/maps/@28.135394,76.650181,17z", 28.135394, 76.650181);
  });
  it("accepts a [lat, lng] pair or an object", () => {
    expect(parseCoords([28.1, 76.6])).toEqual({ lat: 28.1, lng: 76.6 });
    expect(parseCoords({ lat: 28.1, lng: 76.6 })).toEqual({ lat: 28.1, lng: 76.6 });
  });
});

describe("parseCoords: rejects what it cannot read", () => {
  const bad = (input: unknown, msg: RegExp) => expect(() => parseCoords(input)).toThrow(msg);
  it("empty", () => bad("", /no coordinates/i));
  it("one number", () => bad("28.135394", /two numbers/i));
  it("three numbers", () => bad("28.1, 76.6, 12", /two numbers/i));
  it("latitude out of range", () => bad("98.1, 76.6", /latitude/i));
  it("longitude out of range", () => bad("28.1, 196.6", /longitude/i));
  it("minutes or seconds of 60 or more", () => {
    bad(`28°61'0"N 76°0'0"E`, /minutes/i);
    bad(`28°10'60"N 76°0'0"E`, /seconds/i);
  });
  it("two latitudes", () => bad("28.1 N, 30.2 S", /two latitudes/i));
  it("a sign and a hemisphere together", () => bad("-28.1 N, 76.6 E", /both/i));
  it("words without numbers", () => bad("near the flyover", /no coordinates/i));
  it("throws a CoordError that keeps the input", () => {
    try { parseCoords("abc"); } catch (e) {
      expect(e).toBeInstanceOf(CoordError);
      expect((e as CoordError).input).toBe("abc");
    }
  });
});
