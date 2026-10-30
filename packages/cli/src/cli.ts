#!/usr/bin/env node
import { PlanError } from "@billboard-planner/core";
import { Command } from "commander";
import { AssetError } from "./assets.js";
import { build } from "./build.js";
import { ReadError } from "./read.js";

const program = new Command()
  .name("billboard-planner")
  .description("Turn a billboard list into one shareable HTML page with a satellite map, photos and costs.");

program.command("build")
  .description("Build a self-contained plan page from plan.yaml, plan.json, a .csv or an .xlsx file")
  .argument("<plan>", "plan file (.yaml, .yml, .json, .csv or .xlsx)")
  .option("-o, --out <file>", "output .html file (default: next to the plan, e.g. plan.html)")
  .option("--no-optimise", "embed photos and logos as they are, without resizing")
  .action(async (planPath: string, opts: { out?: string; optimise: boolean }) => {
    try {
      const r = await build(planPath, { out: opts.out, optimise: opts.optimise });
      const money = new Intl.NumberFormat(r.plan.locale, { style: "currency", currency: r.plan.currency, maximumFractionDigits: 0 });
      const num = (n: number) => n.toLocaleString(r.plan.locale);
      const photos = r.plan.sites.reduce((n, s) => n + s.photos.length, 0);
      for (const w of r.warnings) console.warn(`! ${w}`);
      console.log(`Built ${r.out} (${(r.bytes / 1024 / 1024).toFixed(1)} MB)`);
      console.log(`  ${r.totals.count} sites in ${r.plan.groups.length} group${r.plan.groups.length === 1 ? "" : "s"} · ${num(r.totals.area)} sq ft · ${photos} photo${photos === 1 ? "" : "s"}`);
      console.log(`  Monthly rent ${money.format(r.totals.rate)} · total ${money.format(r.totals.total)}${r.totals.open ? " + costs marked Extra/TBC" : ""}`);
      console.log("  Open it in a browser (it needs internet for map tiles), or share the file.");
    } catch (e) {
      if (e instanceof PlanError || e instanceof AssetError) console.error(e.message);
      else if (e instanceof ReadError) console.error(`Cannot read the plan: ${e.message}`);
      else console.error(e);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
