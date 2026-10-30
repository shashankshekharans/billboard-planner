// Copies the bundled examples and the spreadsheet template into public/ so the app works offline from the repo.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const pub = new URL("../public/", import.meta.url);
rmSync(new URL("examples/", pub), { recursive: true, force: true });
mkdirSync(pub, { recursive: true });
cpSync(new URL("examples/", root), new URL("examples/", pub), {
  recursive: true,
  filter: src => !/[\/]reference([\/]|$)/.test(src) && !/plan\.html$/.test(src)
});
cpSync(new URL("templates/sites-template.xlsx", root), new URL("sites-template.xlsx", pub));
console.log("Copied examples and the sites template into public/");
