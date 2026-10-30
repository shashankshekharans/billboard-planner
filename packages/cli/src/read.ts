import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { sheetToPlan, type SheetInput } from "@billboard-planner/core";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parse as parseYaml } from "yaml";

export const PLAN_EXTENSIONS = [".yaml", ".yml", ".json", ".csv", ".xlsx", ".xls"];
const SHEET_EXTENSIONS = [".csv", ".xlsx", ".xls"];

/** A plan file that cannot be read at all (missing, wrong type, broken YAML). */
export class ReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadError";
  }
}

const read = (path: string) => {
  try { return readFileSync(path); }
  catch { throw new ReadError(`Cannot read ${path}`); }
};

/** CSV rows keyed by header. Values stay text; the column mapping reads numbers. */
export function readCsv(text: string): SheetInput {
  const out = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: h => h.trim() });
  const fatal = out.errors.find(e => e.type === "Delimiter" || e.type === "Quotes");
  if (fatal) throw new ReadError(`CSV problem on row ${(fatal.row ?? 0) + 2}: ${fatal.message}`);
  return { sites: out.data };
}

/**
 * Workbook sheets: sites from the sheet named "Sites" (or the first other sheet), plan settings from
 * "Plan" or "Settings" (two columns), group colours from "Groups". Other sheets ("Read me") are ignored.
 */
export function readWorkbook(data: Uint8Array): SheetInput {
  const wb = XLSX.read(data, { type: "buffer" });
  const find = (re: RegExp) => wb.SheetNames.find(n => re.test(n.trim()));
  const planName = find(/^(plan|settings)$/i), groupsName = find(/^groups?$/i);
  const sitesName = find(/^sites?$/i) ?? wb.SheetNames.find(n => n !== planName && n !== groupsName && !/^read\s*me$/i.test(n.trim()));
  if (!sitesName) throw new ReadError("The workbook has no sites sheet");
  const rows = (name: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]!, { defval: "", raw: true });
  return {
    sites: rows(sitesName),
    ...(planName && { settings: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[planName]!, { header: 1, defval: "", raw: true }) }),
    ...(groupsName && { groups: rows(groupsName) })
  };
}

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
