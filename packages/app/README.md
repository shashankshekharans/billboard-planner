# @billboard-planner/app

The browser app, published to GitHub Pages. Nothing to install for users; plans stay in their browser.

- **Start screen** (an NH-style gantry sign): **View example**, **Start a new plan**, **Open a plan file**. A plan kept in this browser shows as **Continue your plan**.
- **View example** (also at `#example`): the AAJ Swift NH-48 plan, read-only, with **Duplicate as my plan** to copy it into an editable plan. It is bundled with the app (data, photos, logos), so only map tiles and Leaflet need the internet.
- **Editor** (`#edit`): sites (location, coordinates in any format with a live check, size, rate, printing, photos, order) and plan details (title, logo, currency, groups and colours, base, rings, notes), with a live preview of the real page and a Checks panel listing problems and warnings. Changes are saved in this browser (IndexedDB).
- **Open a plan file**: a vendor `.xlsx` / `.csv`, a `plan.yaml` / `plan.json`, or a page downloaded from the app (it carries its own data, so it reopens for editing). Select the photos and logos together with the plan file; sites without photos pick up `<id>.jpg`, `<id>a.jpg`… as the CLI does.
- **Download page**: the same self-contained HTML file the CLI builds.

It uses the other packages' source directly: `core` for validation and maths, the CLI's spreadsheet readers (loaded only when a sheet is opened) and the `template` page, so the app and the CLI always produce the same page.

```bash
npm run dev            # from the repository root: http://localhost:5173
npm run build:app      # packages/app/dist (copies examples/ and the sites template into public/ first)
npm run preview -w @billboard-planner/app   # serve the build on http://localhost:4173
```
