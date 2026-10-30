# @billboard-planner/cli

The `build` command: reads a plan and its photos, writes one self-contained `.html` page.

```bash
billboard-planner build plan.yaml              # → plan.html next to it
billboard-planner build sites.xlsx -o nh48.html
billboard-planner build sites.csv --no-optimise
```

In this repository (until it is published to npm):

```bash
npm install
npm run build
npm run plan -- build examples/aaj-swift-nh48/plan.yaml -o aaj.html
```

## Inputs

| File | What it holds |
|---|---|
| `plan.yaml` / `plan.json` | Everything: plan settings and sites (see [the example](../../examples/aaj-swift-nh48/plan.yaml)). Set `sites: sites.xlsx` (or `.csv`) to keep the sites in a spreadsheet. |
| `.xlsx` | Start from [`templates/sites-template.xlsx`](../../templates/sites-template.xlsx): a **Sites** sheet, an optional **Plan** sheet (setting / value) and an optional **Groups** sheet (group / colour). |
| `.csv` | Sites only; plan settings use their defaults. |

Spreadsheet columns are matched by name, including vendor wording: `S.No`, `Route`, `Media Vehicle`, `Location`, `Fcg`, `Lat Long` (any coordinate format) or `Latitude` + `Longitude`, `Size` (`40 x 30`) or `Width` + `Height`, `Qty`, `Illum.`, `D.C.P.M` / `Rate`, `Days`, `Printing & Mounting` (number, `Extra` or `TBC`), `GST`, `Remarks`, `Photos`. Money such as `₹1,50,000` or `Rs. 24000` is read as a number. Total rows and Area columns are skipped. Unknown columns are listed as a warning.

## Photos and logos

- Paths are relative to the plan file. A site with no photos listed uses `photos/<id>.jpg`, `photos/<id>a.jpg`, `photos/<id>-day.jpg` … in name order.
- Photos are rotated upright, resized to at most 1100 px and saved as JPEG quality 80. Logos stay PNG with their transparent background (sized to 3× their on-page height).
- Everything is embedded as `data:` URIs, so the page works as a single file. It needs internet only for map tiles and the Leaflet script.
- `--no-optimise` embeds files as they are.

## Errors and warnings

Problems are listed together with where they are, for example `sites[3].coords (site 4): No coordinates found in "near the flyover"` or `site 2 photos: photos/2.jpg not found`. Warnings (skipped rows, unused columns, a site far from the rest, swapped latitude/longitude, sites without photos) do not stop the build.

## Scripts

```bash
npm test            # Vitest, including end-to-end builds of the AAJ Swift example from YAML, XLSX and CSV
npm run typecheck
npm run build
node scripts/make-template.mjs   # regenerate templates/sites-template.xlsx
```
