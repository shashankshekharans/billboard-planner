# Billboard Planner — Project Brief for Claude Code

## 1. Purpose

Build an open-source, reusable **Billboard Planner** that turns a list of outdoor (OOH) media sites into a single, shareable, interactive web page: a satellite map with pinned sites, hover cards with photos and commercials, and a summary table.

The first real use is the **AAJ Swift Billboard Plan** (NH-48, Delhi Jaipur Highway and Binalo). It was built by hand as one HTML file. The public copy, `billboard-plan-example.html`, is the **reference implementation** (same as the real plan, but with sample rates): copy its look and behaviour, then generalise it so any team can make their own plan from a data file and a photo folder.

Target: a public GitHub repository that a marketing person can use with little or no coding.

**The AAJ Swift plan ships inside the repo as the default example.** When someone opens the app, the start screen offers "View example: AAJ Swift – NH-48 Billboard Plan". Choosing it opens the full working plan (map, cards, photos, table) so a new user sees what the tool makes before entering any data.

**Privacy rule for the example:** all rates and printing costs in the public example are **sample figures** (section 5). Real vendor rates must never be committed. The warehouse location, AAJ Swift logos and site photos are public and may be used as they are. The example page must say "Sample rates for demonstration" in its subtitle and notes.

---

## 2. What the reference file does (feature checklist)

All of these must exist in the generic tool.

**Layout**
- Header: company logo on the left, plan title ("Billboard Plan") on the right, with a short subtitle.
- Map takes about 65% of the screen height. A drag handle on its bottom edge resizes it (min 300px; double-click resets; arrow keys work when focused).
- Below the map: a summary strip (sites, total area, monthly rent, 30-day total) and then the site table.
- Always light mode, even when the browser or OS is dark (`<meta name="color-scheme" content="light only">`, no dark tokens).

**Map** (Leaflet 1.9.4 from cdnjs)
- Default view: satellite (Esri World Imagery plus Esri reference labels and transport overlays).
- Toggle: Satellite / Map. The road map is Esri World Street Map. **Do not use tile.openstreetmap.org**: it refuses tiles to pages opened from `file://` because they send no Referer.
- "Show all sites" button fits all sites and the base location.
- Pins: numbered teardrop markers, coloured by group (e.g. green for the highway, amber for Binalo). A legend shows the groups.
- **Base location** (here, the company warehouse): a marker made from the company logo mark in a white chip with a brand-red border. Hovering shows the name and coordinates.
- **Radius rings**: dotted white circles (20 km and 50 km) around a chosen centre (currently Gurgaon city centre, 28.4595, 77.0266), each labelled. A legend checkbox shows or hides them. The ring centre and radii must be configurable; the user may want them centred on the base location.

**Hover card**
- Opens when hovering a pin (tap on touch screens) and stays open while the mouse is over the card. Closes 300 ms after the mouse leaves.
- **Must not pan or scroll the map.** It is a custom absolutely positioned panel, not a Leaflet popup with `autoPan`. It opens beside the pin, flips to the other side near an edge, is clamped inside the map, follows the pin on zoom or pan, and scrolls internally if the map is short.
- Content: photo (shown whole with `object-fit: contain` so the GPS stamp stays visible), with arrows and an "n / N" counter when a site has several photos; group and site number; location name; "Facing X" chip; a highlighted strip with **distance from base location** (straight-line); media vehicle; coordinates; size; area; monthly rate; printing & mounting; illumination; duration; 30-day total; notes (e.g. "Printing extra, GST extra"); "Open in Google Maps" link.

**Table** (compact, 9 columns)
- Columns: #, Location, Size (ft), Area (sq ft), Illum., Rate / month, Printing & mounting, Total for 30 days, From warehouse.
- The Location cell holds the site name plus a grey sub-line with media vehicle, facing direction and coordinates. The coordinates link to Google Maps.
- Rows are grouped under group headings, with a subtotal per group and a grand total in the footer.
- Clicking a row (or pressing Enter) scrolls to the map, flies to the site at zoom 17 and opens its card. Hovering a row highlights its pin; an open card highlights its row.
- Notes under the table: Qty and days are common to all rows, printing is one-time, N/L = non-lit, distances are straight-line, GST notes.

**Output**
- One self-contained `.html` file: logo, photos and data embedded as data URIs (about 1.1 MB for 10 photos). It needs internet only for map tiles and the Leaflet script. It can be emailed or sent on WhatsApp.

---

## 3. Known constraints and lessons learned

1. **Claude.ai artifacts cannot show live maps.** Their CSP blocks images from any outside host, so map tiles never load. Claude's file preview has the same limit. The plan must be opened as a downloaded file in a normal browser, or hosted (e.g. GitHub Pages).
2. **OpenStreetMap's tile server rejects `file://` pages** (no Referer). Use Esri tiles, or let the user configure a provider with a key (MapTiler, Mapbox, Stadia).
3. **Tile licensing:** Esri World Imagery and OSM tiles have usage terms. The README must explain them, keep attribution visible, and make the tile provider configurable. Never bulk-download or pre-cache tiles.
4. **Logos:** keep the alpha channel when resizing. Converting RGBA to RGB turned a transparent logo's background black.
5. **Coordinates arrive in mixed formats.** Vendors send decimal ("28.135394, 76.650181", "Lat 28.186815, Long 76.722692", "28.30119° 76.872404°") and DMS ("Lat 28°10'58.4895"N, Long 76°43'3.3067"E"). The importer must parse all of these.
6. **Money is Indian-formatted** (₹4,66,000). Use `toLocaleString("en-IN")`, but make the currency and locale configurable.
7. **Vendor sheets** use OOH terms: D.C.P.M (display cost per month), Fcg (facing), N/L (non-lit), Black Back (flex type), Media Vehicle (Hoarding, Unipole, Gantry, Bus shelter…).
8. **Site photos** often come from "GPS Map Camera" with a stamped lat/long. Future idea: read the stamp or the EXIF GPS to match photos to sites automatically. In this project, every photo's stamp matched its site's coordinates.

---

## 4. Target product: generic Billboard Planner

### 4.1 Users and flow
**Start screen (first thing the user sees when the app opens)**
- Three choices: **View example** (AAJ Swift), **Start a new plan**, **Open a plan file** (`.json` / `.yaml` / `.xlsx`, or a previously exported plan).
- The example opens read-only, with a banner: "This is an example plan. Duplicate it to edit." **Duplicate as my plan** copies it into a new editable plan so users can learn by changing it.
- The example must work fully offline from the repo (data, photos and logos bundled), apart from map tiles.
- The example is also reachable by URL (e.g. `#example`) and from a link in the app's menu at any time.

**Making a plan**
1. Fill a spreadsheet (CSV or XLSX, from a template) or a `plan.json` / `plan.yaml`.
2. Put photos in `photos/` named by site ID (`1.jpg`, `6a.jpg`, `6b.jpg`, `binalo-day.jpg`…).
3. Add a logo (and an optional marker logo).
4. Run one command (e.g. `npx billboard-planner build plan.yaml`), or use a browser-based editor. Get one self-contained `plan.html`.

### 4.2 Must-have features (v1)
- Everything in section 2, driven by config instead of hard-coded values.
- A browser app (hosted on GitHub Pages) with the start screen in 4.1 and the bundled AAJ Swift example. The CLI build is the second way to produce the same output.
- Importers: CSV, XLSX (header mapping that accepts the vendor names above), JSON, YAML.
- Coordinate parser for decimal, DMS and "Lat … Long …" strings, with validation (warn if a point is far from the others).
- Photo optimisation (resize to about 1100px, JPEG quality 80) and embedding; several photos per site.
- Configurable: title, subtitle, logos, brand colours, groups (name and colour), base location(s), ring centre and radii, currency and locale, tile providers, default view, card fields, table columns.
- Cost maths: area = W × H × qty; total = rate × months + one-time printing; "Extra" or "TBC" for missing values with footnotes; GST or tax notes; subtotals per group and a grand total.
- Distance from base location: straight-line (haversine) by default. Road distance through OSRM or another routing API as an option, computed at build time and cached in the output.
- Light theme by default, with an optional dark theme.
- Accessible: keyboard focus, ARIA on controls, reduced motion respected.

- Basic editor in the browser: edit plan details and sites in a form or table, upload photos and logos, and export the self-contained HTML.

### 4.3 Nice-to-have (v2+)
- Richer editor: add sites by clicking the map, drag pins to correct positions.
- Status per site (proposed, shortlisted, booked, live) with a filter.
- Campaign dates and a booking calendar.
- Export: CSV or XLSX of the table, a PDF summary (server-side or headless), a KML for Google Earth.
- Several base locations (warehouses, stores) and nearest-base distance.
- Traffic or visibility notes, competitor boards, reach estimates.
- Hosting guide (GitHub Pages, Netlify) with a password option.
- i18n of UI labels.

### 4.4 Suggested tech
- TypeScript, Node 20+.
- Build CLI: `commander` or `cac`; `xlsx` (SheetJS) and `papaparse` for import; `sharp` for images; `yaml` for config; `zod` for schema validation.
- Output template: plain HTML, CSS and vanilla JS with Leaflet from cdnjs (pinned version), so the output has no build step or framework.
- Optional editor: Vite with a small framework (Svelte or Preact) that reuses the same renderer.
- Tests: Vitest for parsers, maths and coordinate handling; Playwright for a smoke test of the generated page (cards open without panning, row click flies to the pin, resize handle works).

### 4.5 Suggested repo layout
```
billboard-planner/
  README.md              # quick start, screenshots, tile licensing note
  LICENSE                # MIT
  packages/
    core/                # schema, parsers, cost maths, distance
    cli/                 # build command
    template/            # HTML/CSS/JS of the generated page
    app/                 # browser app: start screen, example viewer, editor (deployed to GitHub Pages)
  examples/
    aaj-swift-nh48/      # DEFAULT EXAMPLE shown on the start screen
      plan.yaml
      photos/            # 1.jpg … 7.jpg, 8a.jpg (day), 8b.jpg (night), 8c.jpg (day 2)
      logos/             # aaj-swift.png (header), aaj-mark.png (warehouse marker)
      reference/billboard-plan-example.html   # sample-rate reference build
    index.json           # list of bundled examples; AAJ Swift is first and marked default
  templates/
    sites-template.xlsx  # blank vendor sheet with expected headers
  docs/
```

### 4.6 Data model (draft)
```yaml
plan:
  title: Billboard Plan
  subtitle: NH-48 corridor · Delhi Jaipur Highway & Binalo
  logo: logos/aaj-swift.png          # header
  currency: INR
  locale: en-IN
  theme: light
  brand: { primary: "#c1202d" }
  map:
    default_view: satellite          # satellite | road
    providers: { satellite: esri-imagery, road: esri-street }
  bases:
    - id: warehouse
      name: AAJ Swift Warehouse
      lat: 28.24132198237465
      lng: 76.9355599373958
      marker_logo: logos/aaj-mark.png
      distance_from: true            # show distance to this base
  rings:
    center: { lat: 28.4595, lng: 77.0266, label: Gurgaon }   # or: base: warehouse
    radii_km: [20, 50]
    visible: true
  groups:
    - { id: hwy, name: Delhi Jaipur Highway, color: "#0f6b3e" }
    - { id: binalo, name: Binalo – Near Stella Showroom, color: "#c27a06" }
  notes:
    - Printing & mounting is a one-time charge (black back).
sites:
  - id: "1"
    group: hwy
    media_vehicle: Hoarding
    location: Delhi Rd. Kasola Chowk Before Flyover
    facing: Jaipur
    coords: "28.135394, 76.650181"   # any supported format
    width_ft: 40
    height_ft: 30
    qty: 1
    illumination: N/L
    rate_per_month: 36000            # sample rate
    days: 30
    printing: 12000                  # sample; number | "extra" | "tbc"
    tax_note: null
    photos: [photos/1.jpg]
```

---

## 5. Example dataset: AAJ Swift (default example, `examples/aaj-swift-nh48`)

This is the example on the start screen. Its output must match `billboard-plan-example.html` and the totals below, and the test suite should check that.

**All money figures below are SAMPLE rates for demonstration.** Locations, sizes, coordinates, photos, logos and the warehouse are real and public.

Base: **AAJ Swift Warehouse**, 28.24132198237465, 76.9355599373958
Rings: 20 km and 50 km around Gurgaon city centre (28.4595, 77.0266)

**Group: Delhi Jaipur Highway** (green)

| # | Media vehicle | Location | Facing | W×H ft | Area | Illum. | Sample rate / month | Days | Sample printing | Total, 30 days | Coordinates (decimal) | Original coordinate text | From warehouse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hoarding | Delhi Rd. Kasola Chowk Before Flyover | Jaipur | 40×30 | 1200 | N/L | 36,000 | 30 | 12,000 | 48,000 | 28.135394, 76.650181 | 28.135394, 76.650181 | 30.3 km |
| 2 | Hoarding | Delhi Rd – Agarwal Movers & Packers | Delhi | 40×20 | 800 | N/L | 24,000 | 30 | 8,000 | 32,000 | 28.182914, 76.717585 | Lat 28°10'58.4895"N, Long 76°43'3.3067"E | 22.3 km |
| 3 | Hoarding | Opp. N.H. Desi Hotel, Khijuri Agarwal Movers | Jaipur | 40×20 | 800 | N/L | 24,000 | 30 | 8,000 | 32,000 | 28.186815, 76.722692 | Lat 28.186815, Long 76.722692 | 21.7 km |
| 4 | Hoarding | Opp. N.H. Desi Hotel, Khijuri Agarwal Movers | Delhi | 40×20 | 800 | N/L | 24,000 | 30 | 8,000 | 32,000 | 28.187389, 76.723787 | 28.187389, 76.723787 | 21.6 km |
| 5 | Hoarding | Delhi Road – Dharuheda Rajwada | Jaipur | 40×20 | 800 | N/L | 26,000 | 30 | 8,000 | 34,000 | 28.204861, 76.767246 | 28.204861, 76.767246 | 17.0 km |
| 6 | Hoarding | Delhi Road – Dharuheda | Jaipur | 80×30 | 2400 | N/L | 72,000 | 30 | 24,000 | 96,000 | 28.220244, 76.796553 | Lat 28°13'12.8789"N, Long 76°47'47.5908"E | 13.8 km |
| 7 | Hoarding | Delhi Road – Dharuhera | Delhi | 50×20 | 1000 | N/L | 32,000 | 30 | 10,000 | 42,000 | 28.221989, 76.797893 | 28.221989, 76.797893 | 13.7 km |

Subtotal: area 7,600 sq ft · rent ₹2,38,000 · printing ₹78,000 · total ₹3,16,000

**Group: Binalo – Near Stella Showroom** (amber)

| # | Media vehicle | Location | W×H ft | Area | Illum. | Sample rate / month | Printing | Tax | Coordinates | From warehouse |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 | Unipole | Binalo – Near Stella Showroom (NH-48, Village Binola, Gurugram) | 30×15 | 450 | — | 1,50,000 | Extra (TBC) | GST extra | 28.301190, 76.872404 | 9.1 km |

Grand total: 8 sites · 8,250 sq ft · rent ₹3,88,000 · printing ₹78,000 + Binalo extra · **₹4,66,000 + Binalo printing + GST**

Binalo is kept with printing "Extra" and "GST extra" on purpose: it shows how missing costs and tax notes look.

**Photos:** one per highway site (1–7); three for Binalo (day, night-lit, second day view). All are GPS Map Camera shots with a stamped location and a red box around the board. They are embedded in `billboard-plan-example.html`. Extract them from the `photos:[...]` arrays in its `SITES` data, or ask the owner for the originals.

**Logos:** full "AAJ swift" wordmark (red AAJ + dark script "swift") in the header; red "AAJ" mark only for the warehouse marker. Both PNGs have transparent backgrounds. Brand red is about #C1202D.

---

## 6. First tasks for Claude Code

1. Set up the repo as in 4.5, with MIT licence and README skeleton. Put the AAJ Swift example in `examples/aaj-swift-nh48` first (extract the photos from the reference HTML into `photos/`).
2. Port `billboard-plan-example.html` into `packages/template`, replacing hard-coded data with an injected JSON blob. Keep behaviour identical.
3. Write `core`: zod schema for 4.6, coordinate parser (with tests using the five formats in section 3), cost maths, haversine.
4. Write the CLI `build` command: read YAML/JSON/CSV/XLSX, optimise and embed images, output one HTML file.
5. Recreate the AAJ Swift plan from `examples/aaj-swift-nh48/plan.yaml` and check that the output matches the reference (same totals: ₹4,66,000*; same distances).
6. Build the browser app: start screen with **View example**, **Start a new plan** and **Open a plan file**; the example opens the AAJ Swift plan with a "Duplicate as my plan" button; deploy to GitHub Pages.
7. Add the Playwright smoke test (start screen → View example → map loads, 8 pins + warehouse, card opens on hover without panning, grand total ₹4,66,000) and a GitHub Actions workflow.
8. Write the README from section 7: a screenshot of the AAJ Swift example at the top, a "Try the example" link, quick start, the spreadsheet template, tile-provider and licensing notes, and how to share the output file. Set the GitHub About text and topics from section 7 (or list them for the owner to paste).

Keep `billboard-plan-example.html` in `examples/aaj-swift-nh48/reference/`. Never add a file with real vendor rates; add `*-private.*` and `private/` to `.gitignore` so teams can keep their real plans next to the repo safely.

Work in stages: finish and commit each task before starting the next, and stop after each stage with a short summary so the owner can review.

---

## 7. Repository text

**Repo name:** `billboard-planner`

**GitHub "About" description (one line):**
> Turn a vendor's billboard list into a live satellite map your whole team can read. Pins, photos, rates and distances in one shareable HTML file.

**Topics:** `billboard` `outdoor-advertising` `ooh` `media-planning` `leaflet` `maps` `satellite` `marketing` `hoarding` `static-site`

**README opening (use as written, then add the technical sections below it):**

```markdown
# Billboard Planner

**See every billboard before you book it.**

Media vendors send billboard options as a spreadsheet: a location name, a size, a rate, and if you are lucky, a photo and a pair of coordinates. Deciding from that means jumping between Excel, Google Maps and WhatsApp photos, and still not knowing which board faces which way or how far it is from where your customers are.

Billboard Planner puts it all on one page. Drop in the vendor sheet and the site photos, and you get a satellite map with every board pinned, a card for each site with its photo, size, rate and distance from your base, and a clean costing table with totals underneath. The result is a single HTML file you can email, share on WhatsApp or host anywhere.

### Try the example
Open the app and choose **View example** to explore a real plan: seven hoardings and a unipole along the NH-48 Delhi–Jaipur Highway near Dharuhera, planned by **AAJ Swift** from its Gurugram warehouse. (Rates in the example are sample figures.)

### What you get
- 🛰️ **Satellite and road map** with numbered, colour-coded pins for every site
- 🖼️ **Hover cards** with site photos, size, rate, printing cost and facing direction
- 📍 **Distance from your base**, such as a warehouse, store or office, for every site
- ⭕ **Radius rings** (e.g. 20 km and 50 km) to see coverage at a glance
- 📊 **Costing table** grouped by route, with subtotals and a grand total
- 📦 **One self-contained file**: photos, logo and data built in, nothing to install for viewers
- 🧭 Reads vendor coordinates in any common format, including degrees-minutes-seconds

### Made for
Marketing teams, media planners and agencies who buy outdoor (OOH) media: hoardings, unipoles, gantries and bus shelters.
```

