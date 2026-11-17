---
target: generated plan page and browser app
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Admin\\OneDrive - AAJ Supply Chain Management Pvt Ltd\\Desktop\\AAJ\\AI Projects\\Billboard Planner\\packages\\template\\template.html"
target_fingerprint: "sha256:f6bdbde5cea750e00dfad5253373ecb84ef0923e18ab8f1c7e4f1998f394ef32"
target_path: "C:\\Users\\Admin\\OneDrive - AAJ Supply Chain Management Pvt Ltd\\Desktop\\AAJ\\AI Projects\\Billboard Planner\\packages\\template\\template.html"
timestamp: 2026-11-17T08-59-39Z
slug: packages-template-template-html
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent)

Heuristics: 1 Status 3 · 2 Real world 3 · 3 Control 2 · 4 Consistency 3 · 5 Error prevention 2 · 6 Recognition 3 · 7 Flexibility 2 · 8 Aesthetic 3 · 9 Recovery 2 · 10 Help 2 = 25/40 (Acceptable)

Specificity: authored for Indian OOH buying (gantry start screen, highway-sign green, warehouse chip, D.C.P.M/N/L vocabulary, Indian number format). Editor is generic form-SaaS.

Detector: template.html 1 advisory (repeating-stripes-gradient, photo placeholder, borderline). App: border-accent-on-rounded (known, ignored when run from packages/app). Overlay: plan page 5 (amber #c27a06 contrast x3: Binalo heading 3.1:1, white-on-amber badge 3.5:1, "Extra" 3.5:1; Leaflet attribution 3.3:1; clipped ring label), app start nested-cards (gantry sign wrapper, false positive). No overflow or console errors. Phone touch targets under 44px: pins 30x30, zoom 30x30, rings checkbox 13x13, Map key 42x21.

Priority issues:
- [P0] App: Duplicate as my plan / Start a new plan on #example overwrite the saved plan without warning; one storage slot.
- [P1] Plan page: pins not operable by keyboard, duplicate accessible names, card focus not managed, no Escape.
- [P1] Plan page phone: tap card fills map; rate/total below internal scroll; x overlaps zoom control.
- [P1] Both: pins overlap at fit zoom (3/4 under 2, 7 under 6); ring label clipped by controls on phone.
- [P2] App: example warehouse coordinates blank in Plan details (lat/lng not mapped to coords field).
- [P2] Amber contrast below AA (badge, group heading, Extra).

Minor: "₹0 + extra" subtotal wording; asterisk never explained; tax note only on card; no saved indicator; locale-code fields; tab ARIA incomplete; alert() for bad images.
