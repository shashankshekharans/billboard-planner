import { writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { planTotals, resolvePlan, type PlanData, type Totals } from "@billboard-planner/core";
import { renderPlan } from "@billboard-planner/template";
import { embedAssets } from "./assets.js";
import { readPlanFile } from "./read.js";

export interface BuildOptions {
  /** Output file. Default: next to the plan, same name with .html (plan.yaml → plan.html). */
  out?: string;
  /** Resize and recompress photos and logos (default true). */
  optimise?: boolean;
}
export interface BuildResult { out: string; bytes: number; plan: PlanData; totals: Totals; warnings: string[] }

export const defaultOut = (planPath: string) => {
  const full = resolve(planPath);
  return join(full, "..", basename(full, extname(full)) + ".html");
};

/**
 * Build one self-contained HTML page from a plan file (YAML, JSON, CSV or XLSX) and its images.
 * @throws ReadError, PlanError or AssetError with readable messages
 */
export async function build(planPath: string, { out, optimise = true }: BuildOptions = {}): Promise<BuildResult> {
  const { file, dir, warnings: readWarnings } = readPlanFile(planPath);
  const { plan, warnings: planWarnings } = resolvePlan(file);
  const { plan: embedded, warnings: assetWarnings } = await embedAssets(plan, dir, { optimise });

  const target = resolve(out ?? defaultOut(planPath));
  if (target === resolve(planPath)) throw new Error(`The output ${target} would overwrite the plan file`);
  const html = renderPlan(embedded as unknown as Record<string, unknown>);
  writeFileSync(target, html);

  return {
    out: target,
    bytes: Buffer.byteLength(html),
    plan,
    totals: planTotals(plan.sites, plan.groups).grand,
    warnings: [...readWarnings, ...planWarnings, ...assetWarnings]
  };
}
