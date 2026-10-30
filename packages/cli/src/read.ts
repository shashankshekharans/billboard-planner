import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { sheetToPlan, type SheetInput } from "@billboard-planner/core";
import { readCsv, readWorkbook, ReadError } from "./sheets.js";
import { parse as parseYaml } from "yaml";

export { readCsv, readWorkbook, ReadError };

export const PLAN_EXTENSIONS = [".yaml", ".yml", ".json", ".csv", ".xlsx", ".xls"];
const SHEET_EXTENSIONS = [".csv", ".xlsx", ".xls"];

const read = (path: string) => {
  try { return readFileSync(path); }
  catch { throw new ReadError(`Cannot read ${path}`); }
};

function readSheet(path: string): SheetInput {
  return extname(path).toLowerCase() === ".csv" ? readCsv(read(path).toString("utf8")) : readWorkbook(read(path));
}

/**
 * Read a plan from YAML, JSON, CSV or XLSX into a plan file object (not yet validated).
 * A YAML or JSON plan may set `sites: sites.xlsx` (or .csv) to take its sites from a spreadsheet.
 * @returns the plan file object, the folder that relative paths in it are relative to, and warnings
 */
export function readPlanFile(path: string): { file: unknown; dir: string; warnings: string[] } {
  const full = resolve(path), dir = dirname(full), ext = extname(full).toLowerCase();
  if (!PLAN_EXTENSIONS.includes(ext)) throw new ReadError(`${path}: use a ${PLAN_EXTENSIONS.join(", ")} file`);

  if (SHEET_EXTENSIONS.includes(ext)) {
    const { file, warnings } = sheetToPlan(readSheet(full));
    return { file, dir, warnings };
  }

  const text = read(full).toString("utf8");
  let file: unknown;
  try { file = ext === ".json" ? JSON.parse(text) : parseYaml(text); }
  catch (e) { throw new ReadError(`${path} is not valid ${ext === ".json" ? "JSON" : "YAML"}: ${(e as Error).message}`); }

  const obj = file as { plan?: Record<string, unknown>; sites?: unknown };
  if (obj && typeof obj.sites === "string") {
    const sheetPath = resolve(dir, obj.sites);
    if (!SHEET_EXTENSIONS.includes(extname(sheetPath).toLowerCase())) throw new ReadError(`sites: ${obj.sites} must be a .csv or .xlsx file`);
    const { file: merged, warnings } = sheetToPlan(readSheet(sheetPath), obj.plan ?? {});
    return { file: merged, dir, warnings };
  }
  return { file, dir, warnings: [] };
}
