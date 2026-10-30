# @billboard-planner/core

Plan schema, coordinate parser, cost maths and distance. No file access: give it parsed YAML or JSON, get back the data the page template renders.

```ts
import { parse } from "yaml";
import { resolvePlan, PlanError } from "@billboard-planner/core";

try {
  const { plan, warnings } = resolvePlan(parse(yamlText));
  warnings.forEach(w => console.warn(w));      // e.g. "Site 9 (…) is 3,850 km from the other sites. Latitude and longitude look swapped."
} catch (e) {
  if (e instanceof PlanError) console.error(e.issues.join("\n"));   // e.g. "sites[3].width_ft (site 4): Too small: expected number to be >0"
}
```

## What's in it

| Export | Does |
|---|---|
| `resolvePlan(input)` | Validates a plan file against `planSchema`, fills defaults, parses every coordinate, resolves ring centres on a base, checks group and id references, and returns `{ plan, warnings }`. Throws `PlanError` with every problem listed. |
| `planSchema` | zod schema for `plan.yaml` (snake_case, see [the example](../../examples/aaj-swift-nh48/plan.yaml)). Unknown keys are errors, so typos are caught. |
| `parseCoords(text)` | Reads `28.135394, 76.650181`, `Lat 28.186815, Long 76.722692`, `28.30119° 76.872404°`, `Lat 28°10'58.4895"N, Long 76°43'3.3067"E`, degrees + decimal minutes, N/S/E/W letters before or after, typographic quotes, Google Maps links, `[lat, lng]` and `{ lat, lng }`. Without labels the first number is latitude. Values converted from DMS are rounded to 6 decimals. |
| `haversineKm(a, b)` | Straight-line distance, the same formula the page uses. |
| `findOutliers(points)` | Sites far from the rest, flagging likely swapped latitude/longitude. |
| `area`, `rent`, `siteTotal`, `planTotals` | Cost rules: area = W × H × qty; rent = monthly rate × days / 30; total = rent + one-time printing; `"extra"` / `"tbc"` printing counts as 0 and marks the total open (`*`). |

The page template does the same maths in its own vanilla JS, so the generated file needs no library; the tests here pin both to the AAJ Swift reference figures.

## Plan file notes

- `printing`: a number, `extra` or `tbc` (any case; "To be confirmed" works). Left out, it is `tbc`.
- Positions: `coords` in any format above, or `lat` and `lng`.
- `rings.center`: `{ lat, lng, label }`, `{ coords, label }` or `{ base: warehouse }`.
- `cities`: `[{ name: Manesar, coords: "28.3540, 76.9395" }]` adds named city markers. In a spreadsheet's Plan sheet, add `City` rows such as `Manesar: 28.3540, 76.9395`.
- Map providers: `esri-imagery`, `esri-street`, or `{ url, attribution, max_zoom }`.

## Scripts

```bash
npm test            # Vitest
npm run typecheck   # tsc, source and tests
npm run build       # dist/
```
