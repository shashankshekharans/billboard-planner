// Spreadsheet readers with no file access, shared by the CLI and the browser app.
import type { SheetInput } from "@billboard-planner/core";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/** A plan file that cannot be read at all (missing, wrong type, broken YAML). */
export class ReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadError";
  }
}

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
