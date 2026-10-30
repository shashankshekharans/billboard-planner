// Builds the AAJ Swift example from the test fixture, until the CLI can build it from plan.yaml.
// Usage: node scripts/build-example.mjs  ->  dist/aaj-swift-nh48.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPlan } from "../index.js";

const here = new URL("../", import.meta.url);
const exampleDir = new URL("../../examples/aaj-swift-nh48/", here);
const plan = JSON.parse(readFileSync(new URL("test/fixtures/aaj-swift-nh48.json", here), "utf8"));

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const inline = path => `data:${MIME[extname(path).toLowerCase()]};base64,${readFileSync(new URL(path, exampleDir)).toString("base64")}`;

plan.logo = plan.logo && inline(plan.logo);
plan.bases.forEach(b => { if (b.markerLogo) b.markerLogo = inline(b.markerLogo); });
plan.sites.forEach(s => { s.photos = s.photos.map(inline); });

mkdirSync(new URL("dist/", here), { recursive: true });
const out = new URL("dist/aaj-swift-nh48.html", here);
writeFileSync(out, renderPlan(plan));
console.log(`Wrote ${fileURLToPath(out)} (${(readFileSync(out).length / 1024).toFixed(0)} KB)`);
