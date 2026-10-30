// Image handling in the browser: the same targets as the CLI (photos ≤ 1100 px JPEG 80, logos stay PNG with alpha).

export const PHOTO_PX = 1100;
export const LOGO_HEIGHT = { header: 132, marker: 66 };

export const readDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function draw(blob: Blob, scaleFor: (w: number, h: number) => number, mime: "image/jpeg" | "image/png") {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const s = Math.min(1, scaleFor(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  const ctx = canvas.getContext("2d")!;
  if (mime === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL(mime, 0.8);
}

/** A site photo: upright, longest side at most 1100 px, JPEG quality 80. */
export const photoDataUrl = (blob: Blob) => draw(blob, (w, h) => PHOTO_PX / Math.max(w, h), "image/jpeg");

/** A logo: PNG (keeps transparency) at most `maxHeight` px tall. SVG logos are kept as they are. */
export async function logoDataUrl(blob: Blob, maxHeight: number) {
  if (blob.type === "image/svg+xml") return readDataUrl(blob);
  return draw(blob, (_w, h) => maxHeight / h, "image/png");
}

export const isImageFile = (name: string) => /\.(jpe?g|png|webp|gif|svg)$/i.test(name);
