// Writes templates/sites-template.xlsx: a blank vendor sheet with the headers the importer expects.
// Usage: node packages/cli/scripts/make-template.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const out = new URL("../../../templates/sites-template.xlsx", import.meta.url);

const SITE_HEADERS = [
  ["ID", 6], ["Group", 26], ["Media Vehicle", 14], ["Location", 44], ["Facing", 12], ["Coordinates", 40],
  ["Width (ft)", 10], ["Height (ft)", 10], ["Qty", 6], ["Illumination", 12], ["Rate / month", 14], ["Days", 7],
  ["Printing & mounting", 18], ["Tax note", 14], ["Notes", 30], ["Photos", 30]
];

const PLAN = [
  ["Setting", "Value", "What to put here"],
  ["Title", "Billboard Plan", "Big heading at the top right"],
  ["Subtitle", "", "Short line under the title. Put **double stars** around words to make them bold"],
  ["Logo", "", "Company logo file, e.g. logos/logo.png (PNG with a transparent background works best)"],
  ["Currency", "INR", "3-letter code: INR, USD, AED, GBP…"],
  ["Locale", "en-IN", "Number format: en-IN gives 4,66,000; en-US gives 466,000"],
  ["Brand colour", "#c1202d", "Border colour of the base marker"],
  ["Default view", "Satellite", "Satellite or Map"],
  ["Base name", "", "Your warehouse, store or office, e.g. AAJ Swift Warehouse. Distances are measured from here"],
  ["Base coordinates", "", "Any format, e.g. 28.2413, 76.9356"],
  ["Base label", "", "Short word used in the page, e.g. warehouse (\"From our warehouse\")"],
  ["Base logo", "", "Small logo for the base marker on the map, e.g. logos/mark.png"],
  ["Ring centre", "", "Coordinates for the radius rings, or the word base to centre them on your base"],
  ["Ring label", "", "Name of the ring centre, e.g. Gurgaon (\"20 km from Gurgaon\")"],
  ["Ring radii (km)", "", "e.g. 20, 50"],
  ["Show rings", "Yes", "Yes or No: are the rings on when the page opens"],
  ["City", "", "A blue city marker with its name, written as Name: coordinates, e.g. Manesar: 28.3540, 76.9395. Add more City rows for more cities"],
  ["Note", "", "A line under the table. Add more Note rows for more lines"],
  ["Note", "", ""]
];

const GROUPS = [["Group", "Colour"], ["", ""]];

const README = [
  ["Billboard Planner: sites template"],
  [""],
  ["1. Sites sheet: one row per billboard. Only Location, Coordinates, Width, Height and Rate / month are required."],
  ["   Coordinates can be in any common format: 28.135394, 76.650181 · Lat 28.186815, Long 76.722692 · Lat 28°10'58.49\"N, Long 76°43'3.31\"E · a Google Maps link."],
  ["   You can also use separate Latitude and Longitude columns, or a single Size column such as 40 x 30."],
  ["   Vendor column names work too: D.C.P.M, Fcg, Lat Long, Media, Remarks, Printing & Mounting, S.No."],
  ["   Printing & mounting: a number, Extra or TBC. Left empty it shows as TBC."],
  ["   Group: the route or area, e.g. Delhi Jaipur Highway. Rows with the same group are shown together."],
  ["   Photos: file names separated by ; (e.g. photos/8a.jpg; photos/8b.jpg). Leave empty to use photos/<ID>.jpg, photos/<ID>a.jpg … automatically."],
  ["   Totals rows and Area columns are ignored: the planner works them out."],
  ["2. Plan sheet: title, logo, your base location and the radius rings. Leave a value empty to skip it."],
  ["3. Groups sheet (optional): a colour for each group, e.g. #0f6b3e. Groups not listed get a colour automatically."],
  [""],
  ["Build the page: npx billboard-planner build sites.xlsx   →   sites.html"],
  ["Never commit real vendor rates to a public repository. Name the file something-private.xlsx or keep it in a private/ folder."]
];

const sheet = (rows, widths) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map(wch => ({ wch }));
  return ws;
};

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet([SITE_HEADERS.map(([h]) => h)], SITE_HEADERS.map(([, w]) => w)), "Sites");
XLSX.utils.book_append_sheet(wb, sheet(PLAN, [18, 30, 90]), "Plan");
XLSX.utils.book_append_sheet(wb, sheet(GROUPS, [30, 12]), "Groups");
XLSX.utils.book_append_sheet(wb, sheet(README, [150]), "Read me");
writeFileSync(out, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log(`Wrote ${fileURLToPath(out)}`);
