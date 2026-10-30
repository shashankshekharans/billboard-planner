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

---

> **Status: early development.** The build command works from this repository (below); the browser app is not built yet.

<!-- TODO: screenshot of the AAJ Swift example and a "Try the example" link to GitHub Pages. -->

## Quick start

1. Fill in the spreadsheet template [`templates/sites-template.xlsx`](templates/sites-template.xlsx), use the vendor's own sheet, or write a `plan.yaml` (see [the example](examples/aaj-swift-nh48/plan.yaml)).
2. Put site photos in a `photos/` folder next to it, named by site ID (`1.jpg`, `6a.jpg`, `6b.jpg`…), or list them in the Photos column.
3. Add your logo and point to it from the plan.
4. Build one self-contained page:

```bash
npm install
npm run build
npm run plan -- build path/to/sites.xlsx      # writes path/to/sites.html
```

Once published to npm this will be `npx billboard-planner build sites.xlsx`. See [packages/cli](packages/cli/README.md) for the spreadsheet columns and options.

## Plan file

[`examples/aaj-swift-nh48/plan.yaml`](examples/aaj-swift-nh48/plan.yaml) shows every field in use; [packages/core](packages/core/README.md) lists the rules.

## Map tiles and licensing

_Coming soon._ The generated page uses Esri World Imagery and World Street Map tiles, with attribution always visible. Tile providers have their own terms of use; the provider will be configurable. Tiles are never bulk-downloaded or cached.

## Sharing the output

_Coming soon._ The output is one `.html` file. It needs internet only for map tiles and the Leaflet script. It does not work inside chat-app previews (including Claude.ai artifacts), which block outside map tiles: download it and open it in a normal browser, or host it (e.g. GitHub Pages).

## Keeping real rates private

Never commit real vendor rates. Name private plans `*-private.*` or keep them in a `private/` folder; both are ignored by git.

## Repository layout

```
packages/
  core/        schema, parsers, cost maths, distance
  cli/         build command
  template/    HTML/CSS/JS of the generated page
  app/         browser app: start screen, example viewer, editor
examples/
  aaj-swift-nh48/   default example (plan.yaml, photos, logos, reference build)
  index.json        list of bundled examples
templates/     spreadsheet template
docs/
```

## Licence

[MIT](LICENSE). The AAJ Swift name, logos and site photos in `examples/aaj-swift-nh48` belong to AAJ Swift and are included only as an example.
