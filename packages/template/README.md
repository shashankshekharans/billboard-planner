# @billboard-planner/template

The generated plan page: one HTML file with its CSS and vanilla JS inline, Leaflet 1.9.4 from cdnjs, no build step. It was ported from [`examples/aaj-swift-nh48/reference/billboard-plan-example.html`](../../examples/aaj-swift-nh48/reference/billboard-plan-example.html) and behaves the same; everything specific to that plan now comes from injected data.

- `template.html`: the page. It reads its plan from `<script id="plan-data" type="application/json">__PLAN_DATA__</script>`.
- `index.js`: `renderPlan(plan)` fills in the data and `<title>` and returns the finished HTML. The JSON is escaped so text such as `</script>` in a site name cannot break the page.

```js
import { renderPlan } from "@billboard-planner/template";
writeFileSync("plan.html", renderPlan(plan));
```

## Plan data

This is the resolved data the page renders, not the user-facing `plan.yaml`: coordinates are already decimal, and photos and logos should already be `data:` URIs for a self-contained file (plain paths or URLs also work if the files sit next to the page). `packages/core` will turn a `plan.yaml` or spreadsheet into this shape.

| Field | Meaning |
|---|---|
| `title`, `subtitle` | Header text. `**bold**` in the subtitle is shown bold. |
| `logo` | Header logo (image URI), optional. |
| `currency`, `locale` | Money and number formatting, e.g. `INR` + `en-IN` → ₹4,66,000. |
| `brand.primary` | Base marker chip colour. `brand.accent` sets links and focus rings (defaults to the first group's colour). |
| `map.defaultView` | `satellite` or `road`. |
| `map.providers.satellite` / `.road` | `esri-imagery`, `esri-street`, or a custom `{ url, attribution, maxZoom }`. |
| `bases[]` | `{ id, name, lat, lng, markerLogo?, label?, legendLabel?, distanceFrom? }`. The first base with `distanceFrom: true` drives the distance strip and column; `label` is the short word used there ("warehouse"). Without one, the distance column is left out. |
| `rings` | `{ center: { lat, lng, label }, radiiKm: [20, 50], visible }`, optional. |
| `pins[]` | `{ name, kind, lat, lng }`, optional: named places with a label, coloured by kind (`city` blue, `store` purple, `dealer` teal, `competitor` red, `customer` orange, `other` slate), a legend entry per kind, included in "Show all sites". Older data with `cities[]` still shows them as city pins. |
| `groups[]` | `{ id, name, color, soft? }`. Table order follows this list. `soft` is the group heading tint (computed from `color` if missing). |
| `notes[]` | Lines under the table. |
| `sites[]` | See below. Pins are numbered in this order. |

Each site: `{ id, group, mediaVehicle, location, facing, lat, lng, widthFt, heightFt, qty (1), illumination, ratePerMonth, days (30), printing, taxNote, photos[] }`.

- `printing` is a number, `"extra"` or `"tbc"`. The last two show as Extra / TBC, add `*` to totals and a footnote on the card.
- Total = `ratePerMonth × days / 30` + printing. When every site has the same `days`, the column reads "Total, N days".
- `area = widthFt × heightFt × qty`. Distances are straight-line (haversine) from the distance base.

## What viewers can do on the page

Kept in the viewer's browser only (`localStorage` key `bbp:v1:<title>`; if storage is blocked it lasts for the visit):

- **My pins:** Add a pin, tap the map, name it; listed under My pins in the map key with a remove button.
- **Rings:** one slider per ring (1–100 km) and a centre picker (the plan's centre, any base, any pin, or their own pins), with the number of sites inside each ring; Reset rings returns to the plan.
- **Shortlist:** Add to shortlist on a card or the checkbox in the table; a bar shows the count and total with Send on WhatsApp, Copy, Show shortlist only and Clear. Sites missing from an updated plan are dropped.
- **Exports:** Download CSV (one row per site, with a Shortlisted column), Download KML (sites, bases, pins and their own pins) and Print.

On phones the site card opens as a sheet along the bottom of the map, and pins closer than 28 px merge into a numbered group that zooms in when tapped. Pins open their card with Enter or Space; Escape closes it.

## Scripts

```bash
npm test     # unit tests for renderPlan (node:test)
```

`test/fixtures/aaj-swift-nh48.json` is the AAJ Swift plan data in this shape. Build the real page with the CLI from the repository root: `npm run build:example` writes `examples/aaj-swift-nh48/plan.html`.
