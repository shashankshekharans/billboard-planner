import { CoordError, parseCoords, planToFile, planTotals, PlanError, resolvePlan, sheetToPlan, type PlanData, type Totals } from "@billboard-planner/core";
import { readPlanData, renderWith } from "@billboard-planner/template/render";
import TEMPLATE from "../../template/template.html?raw";
import { del, get, set } from "idb-keyval";
import { parse as parseYaml } from "yaml";
import { isImageFile, logoDataUrl, photoDataUrl, readDataUrl, LOGO_HEIGHT } from "./images";

// ---- Types -------------------------------------------------------------------------------------------

/** A plan file being edited (plan.yaml shape). Kept loose: it may be half-filled while the user types. */
export interface SiteDraft {
  id: string; group: string; media_vehicle?: string; location?: string; facing?: string; coords?: string;
  width_ft?: number; height_ft?: number; qty?: number; illumination?: string; rate_per_month?: number;
  days?: number; printing?: number | "extra" | "tbc"; tax_note?: string; notes?: string; photos?: string[];
}
export interface GroupDraft { id: string; name: string; color: string; soft?: string }
export interface BaseDraft { id: string; name: string; label?: string; legend_label?: string; coords?: string; marker_logo?: string; distance_from?: boolean }
export interface PlanDraft {
  title?: string; subtitle?: string; logo?: string; currency?: string; locale?: string; theme?: string;
  brand?: { primary?: string; accent?: string };
  map?: { default_view?: "satellite" | "road"; providers?: Record<string, unknown> };
  bases?: BaseDraft[];
  rings?: { center: { coords?: string; base?: string; label?: string }; radii_km: number[]; visible?: boolean };
  groups: GroupDraft[];
  notes?: string[];
}
export interface FileDraft { plan: PlanDraft; sites: SiteDraft[] }

/** Everything the editor holds: the plan and the images it refers to (path → data: URI). */
export interface Workspace {
  file: FileDraft;
  images: Record<string, string>;
  /** Where it came from, for the start screen ("Continue your plan"). */
  origin: "example" | "new" | "opened" | "duplicate";
  savedAt?: number;
}

// ---- Building the page -------------------------------------------------------------------------------

const basename = (p: string) => p.split(/[\\/]/).pop() ?? p;

/** The image a path in the plan refers to: data:/web addresses as they are, else the uploaded file. */
export function imageFor(ws: Workspace, path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(data:|https?:)/i.test(path)) return path;
  return ws.images[path] ?? ws.images[basename(path)];
}

export interface PageResult { html?: string; plan?: PlanData; totals?: Totals; issues: string[]; warnings: string[] }

/** Check the plan and build the self-contained page (images embedded). */
export function buildPage(ws: Workspace): PageResult {
  const warnings: string[] = [];
  let resolved: { plan: PlanData; warnings: string[] };
  try { resolved = resolvePlan(ws.file); }
  catch (e) {
    if (e instanceof PlanError) return { issues: e.issues, warnings };
    throw e;
  }
  const { plan } = resolved;
  const missing = (path: string, where: string) => { warnings.push(`${where}: ${basename(path)} is missing. Add the image again.`); };
  const logo = imageFor(ws, plan.logo);
  if (plan.logo && !logo) missing(plan.logo, "Logo");
  const embedded: PlanData = {
    ...plan,
    ...(logo ? { logo } : { logo: undefined }),
    bases: plan.bases.map(b => {
      const markerLogo = imageFor(ws, b.markerLogo);
      if (b.markerLogo && !markerLogo) missing(b.markerLogo, `${b.name} marker`);
      return { ...b, markerLogo };
    }),
    sites: plan.sites.map(s => ({
      ...s,
      photos: s.photos.flatMap(p => {
        const uri = imageFor(ws, p);
        if (!uri) missing(p, `Site ${s.id}`);
        return uri ? [uri] : [];
      })
    }))
  };
  return {
    html: renderWith(embedded as unknown as Record<string, unknown>, TEMPLATE),
    plan,
    totals: planTotals(plan.sites, plan.groups).grand,
    issues: [],
    warnings: [...resolved.warnings, ...warnings]
  };
}

export const fileName = (title: string | undefined) =>
  ((title || "billboard-plan").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "billboard-plan") + ".html";

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/html" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Starting points ---------------------------------------------------------------------------------

export function newWorkspace(): Workspace {
  return {
    origin: "new",
    images: {},
    file: {
      plan: { title: "Billboard Plan", subtitle: "", currency: "INR", locale: "en-IN", groups: [{ id: "sites", name: "Sites", color: "#0f6b3e" }], bases: [], notes: [] },
      sites: []
    }
  };
}

export interface ExampleInfo { id: string; title: string; description: string; plan: string; default?: boolean }

export async function listExamples(): Promise<ExampleInfo[]> {
  const r = await fetch("examples/index.json");
  if (!r.ok) throw new Error("The bundled examples could not be loaded.");
  return (await r.json()).examples;
}

/** Load a bundled example with all its images. */
export async function loadExample(info: ExampleInfo): Promise<Workspace> {
  const base = "examples/" + info.plan.replace(/[^/]+$/, "");
  const res = await fetch("examples/" + info.plan);
  if (!res.ok) throw new Error(`The example ${info.title} could not be loaded.`);
  const file = parseYaml(await res.text()) as FileDraft;
  const paths = new Set<string>([
    ...(file.plan.logo ? [file.plan.logo] : []),
    ...(file.plan.bases ?? []).flatMap(b => b.marker_logo ? [b.marker_logo] : []),
    ...file.sites.flatMap(s => s.photos ?? [])
  ]);
  const images: Record<string, string> = {};
  await Promise.all([...paths].map(async p => {
    const r = await fetch(base + p);
    if (r.ok) images[p] = await readDataUrl(await r.blob());
  }));
  return { file, images, origin: "example" };
}

// ---- Opening files -----------------------------------------------------------------------------------

export class OpenError extends Error {}

// The spreadsheet readers (SheetJS) are large: load them only when a sheet is opened.
const sheets = () => import("@billboard-planner/cli/sheets");

const PLAN_FILE = /\.(ya?ml|json|csv|xlsx|xls|html?)$/i;

/**
 * Open a plan from the chosen files: one plan file (.yaml, .json, .csv, .xlsx, or a page Billboard Planner made)
 * plus, optionally, the photos and logos it refers to (matched by file name).
 */
export async function openFiles(files: File[]): Promise<{ ws: Workspace; warnings: string[] }> {
  const planFiles = files.filter(f => PLAN_FILE.test(f.name));
  if (planFiles.length !== 1) throw new OpenError(planFiles.length ? "Choose one plan file at a time (plus its photos)." : "Choose a plan file: .xlsx, .csv, .yaml, .json, or a page you downloaded from Billboard Planner.");
  const pf = planFiles[0]!;
  const warnings: string[] = [];
  let file: FileDraft;
  const ext = pf.name.split(".").pop()!.toLowerCase();

  if (ext === "html" || ext === "htm") {
    const data = readPlanData(await pf.text());
    if (!data) throw new OpenError(`${pf.name} is not a page made by Billboard Planner.`);
    file = planToFile(data as unknown as PlanData) as unknown as FileDraft;
  } else if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    const { readCsv, readWorkbook } = await sheets();
    const sheet = ext === "csv" ? readCsv(await pf.text()) : readWorkbook(new Uint8Array(await pf.arrayBuffer()));
    const r = sheetToPlan(sheet);
    file = r.file as unknown as FileDraft;
    warnings.push(...r.warnings);
  } else {
    try { file = (ext === "json" ? JSON.parse(await pf.text()) : parseYaml(await pf.text())) as FileDraft; }
    catch (e) { throw new OpenError(`${pf.name} could not be read: ${(e as Error).message}`); }
    if (!file || typeof file !== "object" || !("plan" in file)) throw new OpenError(`${pf.name} does not look like a plan file (it needs a plan: section).`);
    if (typeof (file as { sites?: unknown }).sites === "string") throw new OpenError(`${pf.name} takes its sites from ${(file as unknown as { sites: string }).sites}. Open that spreadsheet instead, or put the sites in the file.`);
    file.sites ??= [];
    file.plan.groups ??= [];
  }

  const images: Record<string, string> = {};
  const logoNames = new Set([file.plan.logo, ...(file.plan.bases ?? []).map(b => b.marker_logo)].filter(Boolean).map(p => basename(p!)));
  await Promise.all(files.filter(f => f !== pf && isImageFile(f.name)).map(async f => {
    try {
      images[f.name] = logoNames.has(f.name) ? await logoDataUrl(f, LOGO_HEIGHT.header) : await photoDataUrl(f);
    } catch { warnings.push(`${f.name} could not be read as an image.`); }
  }));

  // Sites without a photo list use photos named after their id (1.jpg, 8a.jpg, binalo-day.jpg), as the CLI does.
  const names = Object.keys(images).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  for (const s of file.sites) {
    if (s.photos?.length) continue;
    const esc = String(s.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${esc}(?:[a-z]|[-_ ].+)?\\.(?:jpe?g|png|webp)$`, "i");
    const found = names.filter(n => re.test(n));
    if (found.length) s.photos = found;
  }
  return { ws: { file, images, origin: "opened" }, warnings };
}

/** Add sites from a spreadsheet to the current plan, matching its groups by id or name. */
export async function importSites(ws: Workspace, f: File): Promise<{ ws: Workspace; warnings: string[] }> {
  const ext = f.name.split(".").pop()!.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(ext)) throw new OpenError("Choose a .xlsx or .csv file of sites.");
  const { readCsv, readWorkbook } = await sheets();
  const sheet = ext === "csv" ? readCsv(await f.text()) : readWorkbook(new Uint8Array(await f.arrayBuffer()));
  const plan = structuredClone(ws.file.plan);
  const { file, warnings } = sheetToPlan(sheet, plan as unknown as Record<string, unknown>);
  const used = new Set(ws.file.sites.map(s => s.id));
  let next = nextId(ws.file.sites);
  const sites = (file.sites as unknown as SiteDraft[]).map(s => {
    if (!used.has(s.id)) { used.add(s.id); return s; }
    const id = String(next++); used.add(id);
    return { ...s, id };
  });
  return { ws: { ...ws, file: { plan: file.plan as unknown as PlanDraft, sites: [...ws.file.sites, ...sites] } }, warnings };
}

export const nextId = (sites: SiteDraft[]) => sites.reduce((m, s) => Math.max(m, Number.parseInt(s.id, 10) || 0), 0) + 1;

/** "28.1, 76.6" → readable check for the coordinates field. */
export function checkCoords(text: string | undefined): { ok: true; lat: number; lng: number } | { ok: false; message: string } | null {
  if (!text?.trim()) return null;
  try { return { ok: true, ...parseCoords(text) }; }
  catch (e) { return { ok: false, message: e instanceof CoordError ? e.message : String(e) }; }
}

// ---- Autosave (this browser only) --------------------------------------------------------------------

const KEY = "billboard-planner:workspace";
export async function loadSaved(): Promise<Workspace | undefined> {
  try { return await get<Workspace>(KEY); } catch { return undefined; }
}
export async function save(ws: Workspace) {
  try { await set(KEY, { ...ws, savedAt: Date.now() }); return true; } catch { return false; }
}
export async function forget() {
  try { await del(KEY); } catch { /* nothing saved */ }
}
