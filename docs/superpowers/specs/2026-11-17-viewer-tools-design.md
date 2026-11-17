# Viewer tools and design fixes: design

Date: 2026-11-17 · Owner: Shashank · Ship target: live on GitHub Pages today

## Why

A Billboard Planner page is a decision document. Today the people who receive it (usually as an HTML file on WhatsApp, often on a phone) can look, but they cannot ask their own questions of the map ("how far is this from our Sohna store?", "what if we only cover 30 km?") or say which boards to book. A design review (Impeccable critique, 25/40) also found a data-loss bug in the app, phone and keyboard problems, and contrast failures. This release lets viewers work with the plan and fixes those problems.

## Goals

1. **Pins (planner and viewer).** Named pins for places that matter (city, store, dealer, competitor, customer, other), each kind with its own colour.
   - Planner pins live in the plan file and everyone sees them. The current `cities` become pins of kind `city`; old plans with `cities` keep working.
   - Viewers can add their own pins on the shared page ("Add a pin", tap the map, name it). These are kept in that browser only.
2. **Radius slider.** On the shared page, the viewer can drag each ring's radius (1–100 km) and choose the ring centre: the plan's ring centre, any base, or any pin (including their own). The page says how many sites fall inside each ring. A reset button returns to the plan's values.
3. **Shortlist and WhatsApp.** The viewer ticks sites (in the card and in the table). A shortlist bar shows the count and total. "Send on WhatsApp" opens WhatsApp with a message listing the chosen sites, their sizes, totals and Google Maps links. "Copy" copies the same text. "Show shortlist only" filters the table.
4. **Exports on the shared page.** Download the table as CSV (opens in Excel; includes a Shortlisted column), download a KML for Google Earth (sites, bases, pins), and a clean print layout.
5. **Fixes from the review:**
   - **App data loss (P0):** on the example screen, "Duplicate as my plan" and "Start a new plan" ask before replacing a plan already kept in this browser.
   - **Blank coordinates (P2):** coordinates stored as `lat`/`lng` in a plan file show in the editor's coordinate fields (bases, ring centre, pins).
   - **Phone card (P1):** at ≤640 px the site card is a bottom sheet over the map, at most about 60% of the map's height, with name, distance and 30-day total before the photo. It no longer covers the map controls.
   - **Overlapping pins (P1):** site pins closer than about 28 px on screen are grouped into one chip showing the count; tapping it zooms to show them. Ring labels move to the bottom of each circle so they don't collide with the top-right controls.
   - **Keyboard and screen reader (P1):**
     - Enter or Space on a focused pin opens its card.
     - Pins are named "Site 3, Opp. N.H. Desi Hotel…, facing Jaipur".
     - The card is a labelled dialog; Escape closes it and returns focus to where the user was.
   - **Contrast (P2):** group colours used as text, and the numbers on coloured badges, are adjusted automatically to reach 4.5:1. "Extra"/"TBC" use a darker amber. Touch targets for pins, the rings checkbox and "Map key" reach about 44 px.
6. **Example.** The AAJ Swift example (in the app and built from `plan.yaml`) shows all of the above. Gurgaon and Manesar become `city` pins. No invented places are added: the example has no fake stores or competitors.

## Non-goals

- Sharing viewer pins or shortlists between people other than via the WhatsApp/copy text.
- Road distances, multiple saved plans in the app, dark theme, filters by budget/size (later).
- Changing the hand-made `reference/billboard-plan-example.html`. It stays as the record of the original data and costs.

## Anti-goals (would make this a failure)

- The shared page needing a server, a login or extra internet beyond map tiles, Leaflet and fonts.
- Anything a viewer does on their copy silently changing what other people see.
- Desktop layout or the costing maths changing for existing plans (beyond the listed fixes).
- The page becoming cluttered: new controls live in the existing map key panel, the card and one shortlist bar; on phones they fold away.

## Constraints

- The generated page stays one self-contained HTML file, plain HTML/CSS/JS, Leaflet 1.9.4 from cdnjs. It is opened from `file://` (WhatsApp), from GitHub Pages, and inside the app's sandboxed preview iframe.
- Viewer state is stored in `localStorage` under a key derived from the plan (title + site coordinates), wrapped in try/catch; the page works when storage is unavailable (state then lasts only for the visit).
- The app preview iframe needs `allow-downloads` for exports. WhatsApp uses `https://wa.me/?text=…` (opens WhatsApp or WhatsApp Web).
- Existing plan files must keep resolving unchanged (`cities` still accepted).
- Tests: unit tests (Vitest, node:test) and Playwright e2e (desktop and phone projects) stay green in CI.

## Approaches considered

- **A. Everything inside the shared page; viewer additions stay in that viewer's browser (chosen).** Works in a WhatsApp-forwarded file; each viewer's notes are private; sharing is explicit via WhatsApp/copy text. Trade-off: a viewer's pins don't reach anyone else unless the planner adds them in the editor.
- B. Like A, plus viewer state encoded in the page address. Only helps hosted pages, not files; long links break in chat. Rejected.
- C. Tools only in the app editor. Simpler, but recipients could not pin, resize or shortlist. Rejected.

## Decisions (as decided with the owner)

- Approach A.
- Pins can be added by both the planner (saved in the plan) and viewers (kept on their device).
- Ship today: pins, radius slider, shortlist + WhatsApp, data-loss and blank-coordinates fixes, phone card and overlapping pins, keyboard and contrast, exports (CSV, KML, print).
- The example showcases the new UI; the hand-made reference file is kept unchanged.

## Data model (builder's guidance)

- Plan file: `plan.pins: [{ name, kind?, coords | lat+lng }]`, kind one of `city, store, dealer, competitor, customer, other` (default `other`). `plan.cities` stays accepted and becomes pins of kind `city` (after any explicit pins).
- Resolved data: `pins: [{ name, kind, lat, lng }]` (replaces `cities`; `planToFile` writes `pins`).
- Spreadsheet Plan sheet: rows named `City`, `Store`, `Dealer`, `Competitor`, `Customer` or `Pin` with value `Name: coordinates` (several separated by `;`).
- Kind colours (fixed, distinct from route-group colours): city blue #1d4ed8, store purple, dealer teal, competitor red, customer orange, other slate; viewer pins use a dashed outline and the label "My pin".

## Calls made after the builder check (Claude's calls, for the owner to check)

- **Editor pins:** the editor's "Cities" section becomes a "Pins" section: name, coordinates, and a kind picker (city, store, dealer, competitor, customer, other), with add and remove. This is how the planner adds pins without a spreadsheet.
- **Viewer state survives plan updates:** viewer pins, ring settings and the shortlist are stored under the plan's title only, and shortlisted sites are matched by site ID. When the planner re-sends an updated plan, the viewer keeps their work; shortlisted sites that no longer exist are dropped.
- **Contrast fix keeps the planner's colours:** pins, legend swatches and badges keep the group colour; the number on a badge switches to dark text when white would fall below 4.5:1, and group colours used as text (group headings, card tags) use a darker shade of the same colour computed to reach 4.5:1.
- **Build order** (so a cut, if needed, removes whole items from the end): data-loss and blank-coordinates fixes → pins (plan + viewer) → radius slider → shortlist and WhatsApp → phone bottom-sheet card → keyboard and contrast → pin clustering and ring labels → exports (CSV, KML, print).

## Left to the builder

- Exact control layout inside the map key panel and the shortlist bar's styling, within the existing design system (Barlow / Barlow Condensed, highway green, light only).
- Clustering method (simple screen-distance grouping is enough; no extra library).
- WhatsApp message wording and CSV/KML column details.
- How the reference comparison e2e test is narrowed (keep: table rows, totals, notes, distances, card figures).
