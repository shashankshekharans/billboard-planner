# Viewer Tools and Design Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let viewers of a plan page add pins, resize radius rings, shortlist and send sites on WhatsApp, and export; fix the review's data-loss, phone, keyboard, contrast and overlap problems.

**Architecture:** Planner data (pins) flows plan file → `core` schema/resolve → template JSON. Viewer features live entirely in `packages/template/template.html` (vanilla JS) with state in `localStorage`; the app edits planner pins and previews the same template.

**Tech Stack:** TypeScript (core, cli, app), zod 4, Preact 10 + Vite 8 (app), vanilla JS + Leaflet 1.9.4 (template), Vitest 5, node:test, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-17-viewer-tools-design.md`

## Global Constraints

- The generated page stays one self-contained HTML file; no new runtime libraries; works from `file://`, GitHub Pages and the app's sandboxed iframe.
- Viewer state: `localStorage` key `bbp:v1:<plan title>`, every access in try/catch; shortlist stored as site IDs.
- `plan.cities` stays accepted (→ pins of kind `city`); resolved data uses `pins` only.
- Pin kinds and colours: city #1d4ed8, store #7c3aed, dealer #0f766e, competitor #b91c1c, customer #c2410c, other #475569; viewer pins dashed outline, label "My pin".
- Radius slider range 1–100 km, step 1.
- Phone breakpoint ≤640 px (existing). Desktop look and all cost maths unchanged except listed fixes.
- Each task ends with all unit + e2e tests green, then commit and push to `main`.

## Review Focus

- Storage unavailable (private mode / sandbox) → page still works; viewer features last for the visit. Test: e2e with `localStorage` throwing.
- A plan with no rings, no bases, or no pins → controls hide cleanly, no errors. Test: e2e on the bare plan.
- Shortlisted site removed in a re-sent plan → dropped silently. Test: unit-level in e2e by seeding storage with an unknown ID.
- Very long pin names / special characters (`<`, `&`) → escaped, no layout break. Test: e2e add pin named `<b>Store & Co</b>`.
- Exports inside the app's sandboxed preview → downloads still work. Test: app e2e clicks Download CSV in the iframe.

---

### Task 1: Data-loss and blank-coordinates fixes

**Files:** Modify `packages/app/src/components/App.tsx`, `packages/app/src/workspace.ts`; Test `e2e/app.spec.ts`

**Interfaces:** Produces `normaliseDraft(file: FileDraft): FileDraft` in `workspace.ts` (fills `coords` from `lat`/`lng` on bases, ring centre and pins/cities).

- [ ] Test: "Duplicate as my plan asks before replacing a saved plan": seed a saved plan (start new plan, add site), go `#example`, click Duplicate, expect a `confirm` dialog; dismissing keeps the saved plan's title.
- [ ] Test: "Plan details shows the warehouse coordinates in the example": duplicate example, open Plan details, `Coordinates` under Your base has value `28.24132198237465, 76.9355599373958`.
- [ ] Implement guard in `App.tsx` (`onDuplicate` and example `onNew` use `saved && confirm(...)` like the start screen) and call `normaliseDraft` in `loadExample` and `openFiles`.
- [ ] Run `npx playwright test e2e/app.spec.ts` → pass; commit `fix: ask before replacing a saved plan; show stored coordinates`; push.

### Task 2: Pins (planner and viewer)

**Files:** Modify `packages/core/src/{model,schema,resolve,tofile,sheet}.ts`, tests `packages/core/src/{resolve,sheet}.test.ts`; `packages/template/template.html`; `packages/app/src/components/PlanForm.tsx`, `packages/app/src/workspace.ts`; `examples/aaj-swift-nh48/plan.yaml`; `packages/template/test/fixtures/aaj-swift-nh48.json`; `packages/cli/src/reference.test.ts`; `packages/cli/scripts/make-template.mjs`; e2e `e2e/page.spec.ts`.

**Interfaces:** Produces `PinKind = "city"|"store"|"dealer"|"competitor"|"customer"|"other"`, `PinData { name: string; kind: PinKind; lat: number; lng: number }`, `PlanData.pins?: PinData[]` (replaces `cities`); `PIN_KINDS` exported from core.

- [ ] Core tests: `pins` with kinds resolve; `cities` resolve to `kind: "city"` after explicit pins; unknown kind rejected with a message listing kinds; `planToFile` round-trips pins; sheet rows `Store: Name: coords` → `{ kind: "store" }`, `City` rows unchanged.
- [ ] Implement schema/resolve/tofile/sheet; update fixture and plan.yaml (`pins:` with Gurgaon, Manesar as `city`); reference.test compares `plan.pins` (kind city) with reference `CITIES`.
- [ ] Template: render planner pins with kind colour; legend lists kinds present ("City", "Store", …); "Add a pin" button in the map key → next map click shows an inline name field → pin saved to storage, drawn with dashed outline and an "×" remove in its tooltip; "My pins (n)" with "Clear" in the key.
- [ ] App: "Pins" section replaces "Cities" (name, coordinates, kind select, add/remove).
- [ ] e2e: planner pins show Gurgaon and Manesar; add pin `<b>Store & Co</b>` by clicking the map, reload → still there, text escaped; remove → gone; with storage throwing, adding still works for the visit.
- [ ] All tests green; commit `feat: pins for planners and viewers`; push.

### Task 3: Radius slider

**Files:** `packages/template/template.html`; e2e `e2e/page.spec.ts`.

**Interfaces:** Consumes pins and viewer pins from Task 2 (centre options). Stores `{ rings: { centre: string, radii: number[] } }` in the viewer state.

- [ ] e2e: the key shows one slider per ring (range 1–100, values 20 and 50); dragging the first to 10 updates the circle radius (Leaflet `getRadius()` = 10000) and the label "10 km from Gurgaon"; "Sites inside" count shows `1` for 10 km around the warehouse centre; choosing centre "AAJ Swift Warehouse" moves the circles; reset restores 20/50 Gurgaon; reload keeps the change.
- [ ] Implement; plan without rings → no ring controls.
- [ ] Green; commit `feat: radius slider and ring centre`; push.

### Task 4: Shortlist and WhatsApp

**Files:** `packages/template/template.html`; e2e `e2e/page.spec.ts`, `e2e/mobile.spec.ts`.

**Interfaces:** `shortlist: string[]` (site IDs) in viewer state; `shortlistText(): string`.

- [ ] e2e: "Add to shortlist" in card and a checkbox per table row stay in sync; bar shows "2 sites · ₹1,28,000"; WhatsApp link href starts `https://wa.me/?text=` and decodes to text containing the plan title, both site names, "₹1,28,000" and a Google Maps link; "Show shortlist only" hides other rows; stored ID that no longer exists is ignored; reload keeps the shortlist.
- [ ] Implement (bar fixed at the bottom on phones).
- [ ] Green; commit `feat: shortlist and send on WhatsApp`; push.

### Task 5: Phone bottom-sheet card

**Files:** `packages/template/template.html`; e2e `e2e/mobile.spec.ts`.

- [ ] e2e (phone): tapping a pin shows the card anchored to the bottom of the map, height ≤ 62% of the map, the 30-day total visible without scrolling the card, and the zoom control not covered.
- [ ] Implement (CSS at ≤640 px; `placeCard` skips positioning on phones; a distance + total strip near the top of the card).
- [ ] Green; commit `feat: phone site card as a bottom sheet`; push.

### Task 6: Keyboard and contrast

**Files:** `packages/template/template.html`; e2e `e2e/page.spec.ts`.

- [ ] e2e: focus `#pin-3`'s marker, press Enter → card opens with focus on its heading; Escape closes and focus returns to the marker; marker accessible name is "Site 3, Opp. N.H. Desi Hotel, Khijuri Agarwal Movers, facing Jaipur"; computed contrast ≥ 4.5 for the Binalo group heading, the "8" badge and "Extra".
- [ ] Implement (`role="dialog"`, `aria-labelledby`; contrast helpers computing text shade and badge text colour; larger touch areas for pins, rings checkbox, Map key).
- [ ] Green; commit `feat: keyboard access and contrast fixes`; push.

### Task 7: Overlapping pins and ring labels

**Files:** `packages/template/template.html`; e2e `e2e/page.spec.ts`, `e2e/mobile.spec.ts`.

- [ ] e2e (phone, fitted view): a cluster chip with text "3" covers sites 2–4; clicking it zooms so pins 2, 3, 4 are separately visible; ring labels sit below their circles; Show all sites restores clusters.
- [ ] Implement screen-distance grouping (≤28 px) recomputed on `zoomend`; table row click still opens the right site.
- [ ] Green; commit `feat: group overlapping pins`; push.

### Task 8: Exports

**Files:** `packages/template/template.html`; `packages/app/src/components/Editor.tsx` (iframe `allow-downloads`); e2e `e2e/page.spec.ts`, `e2e/app.spec.ts`.

- [ ] e2e: "Download CSV" gives `billboard-plan.csv` with header `#,Group,Location,Media vehicle,Facing,Latitude,Longitude,Width (ft),Height (ft),Area (sq ft),Illumination,Rate / month,Printing,Total,From warehouse (km),Shortlisted` and 8 rows; "Download KML" gives a `.kml` with 8 site Placemarks + base + pins; print media hides map controls and the shortlist bar; Download CSV works inside the app preview.
- [ ] Implement; update README and template README for all new features.
- [ ] Green; commit `feat: CSV, KML and print exports`; push; verify the live site.
