import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import type { PlanData } from "@billboard-planner/core";
import sharp from "sharp";

// Photos: longest side about 1100 px, JPEG quality 80 (about 1.1 MB for the 10 example photos).
// Logos: keep PNG and its transparency; three times their on-page height is plenty for sharp screens.
const PHOTO_PX = 1100;
const PHOTO_QUALITY = 80;
const LOGO_HEIGHT = { header: 132, marker: 66 };

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const PHOTO_FILE = /\.(jpe?g|png|webp)$/i;

export class AssetError extends Error {
  constructor(readonly issues: string[]) {
    super(`Some images could not be used:\n- ${issues.join("\n- ")}`);
    this.name = "AssetError";
  }
}

const dataUri = (mime: string, data: Buffer) => `data:${mime};base64,${data.toString("base64")}`;

async function optimisePhoto(data: Buffer) {
  return sharp(data).rotate()
    .resize({ width: PHOTO_PX, height: PHOTO_PX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
    .toBuffer();
}
async function optimiseLogo(data: Buffer, height: number) {
  return sharp(data).resize({ height, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();   // PNG keeps alpha
}

/**
 * Photos named after the site id in a photos/ folder: 1.jpg, 6a.jpg, 6b.jpg, binalo-day.jpg (for id "binalo").
 * Sorted by name, so 8a, 8b, 8c keep their order.
 */
export function matchPhotos(id: string, files: string[]): string[] {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}(?:[a-z]|[-_ ].+)?\\.(?:jpe?g|png|webp)$`, "i");
  return files.filter(f => re.test(f)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/**
 * Embed the logo, base marker logos and site photos as data: URIs so the page is one self-contained file.
 * Sites without a photo list get photos from photos/<id>*.jpg. Web addresses are left as they are.
 * @returns a copy of the plan with embedded images, and warnings
 * @throws AssetError listing every image that is missing or unreadable
 */
export async function embedAssets(plan: PlanData, dir: string, { optimise = true } = {}): Promise<{ plan: PlanData; warnings: string[] }> {
  const issues: string[] = [], warnings: string[] = [];
  const cache = new Map<string, Promise<string | undefined>>();

  const embed = (path: string, kind: "photo" | "header" | "marker", where: string): Promise<string | undefined> => {
    if (/^data:/i.test(path)) return Promise.resolve(path);
    if (/^https?:\/\//i.test(path)) {
      warnings.push(`${where}: ${path} is a web address, so the page needs internet to show it.`);
      return Promise.resolve(path);
    }
    const file = resolve(dir, path), cacheKey = `${kind}:${file}`;
    if (!cache.has(cacheKey)) cache.set(cacheKey, (async () => {
      const ext = extname(file).toLowerCase();
      if (!existsSync(file)) { issues.push(`${where}: ${path} not found`); return undefined; }
      if (!MIME[ext]) { issues.push(`${where}: ${path} is not a supported image (use .jpg, .png or .webp)`); return undefined; }
      const data = readFileSync(file);
      if (!optimise || ext === ".svg" || ext === ".gif") return dataUri(MIME[ext]!, data);
      try {
        const out = kind === "photo" ? await optimisePhoto(data) : await optimiseLogo(data, LOGO_HEIGHT[kind]);
        const mime = kind === "photo" ? "image/jpeg" : "image/png";
        // Keep the original when it is already in the target format and no bigger.
        return MIME[ext] === mime && data.length <= out.length ? dataUri(mime, data) : dataUri(mime, out);
      } catch (e) {
        issues.push(`${where}: ${path} could not be read as an image (${(e as Error).message})`);
        return undefined;
      }
    })());
    return cache.get(cacheKey)!;
  };

  const photoDir = join(dir, "photos");
  const photoFiles = existsSync(photoDir) ? readdirSync(photoDir).filter(f => PHOTO_FILE.test(f)) : [];

  const [logo, bases, sites] = await Promise.all([
    plan.logo ? embed(plan.logo, "header", "logo") : Promise.resolve(undefined),
    Promise.all(plan.bases.map(async b => {
      const markerLogo = b.markerLogo && await embed(b.markerLogo, "marker", `base ${b.id} marker_logo`);
      return { ...b, ...(markerLogo && { markerLogo }) };
    })),
    Promise.all(plan.sites.map(async s => {
      let paths = s.photos;
      if (!paths.length) {
        paths = matchPhotos(s.id, photoFiles).map(f => relative(dir, join(photoDir, f)).replace(/\\/g, "/"));
        if (!paths.length) warnings.push(`Site ${s.id} (${s.location}) has no photo.`);
      }
      const photos = await Promise.all(paths.map(p => embed(p, "photo", `site ${s.id} photos`)));
      return { ...s, photos: photos.filter((p): p is string => !!p) };
    }))
  ]);

  if (issues.length) throw new AssetError(issues);
  return { plan: { ...plan, ...(logo ? { logo } : {}), bases, sites }, warnings };
}
