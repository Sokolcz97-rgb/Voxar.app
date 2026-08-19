/**
 * Client-side background removal tailored for badge / avatar-frame artwork.
 *
 * 1. Flood fill from the image borders and erase every connected dark pixel
 *    (the solid black backdrop around the emblem).
 * 2. Flood fill from the centre and erase the connected dark disc, turning the
 *    middle of the badge into a transparent hole for the profile picture.
 */

export interface RemoveBgOptions {
  /** 0-255 luminance under which a pixel counts as "background". */
  threshold?: number;
  /** Erase the dark disc in the middle of the badge. */
  cutCenter?: boolean;
}

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function floodErase(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  seeds: number[],
  threshold: number,
  visited: Uint8Array,
) {
  const stack = seeds.slice();
  while (stack.length) {
    const idx = stack.pop()!;
    if (idx < 0 || idx >= w * h || visited[idx]) continue;
    const p = idx * 4;
    if (data[p + 3] === 0) {
      visited[idx] = 1;
      continue;
    }
    if (luminance(data[p], data[p + 1], data[p + 2]) > threshold) continue;
    visited[idx] = 1;
    data[p + 3] = 0;
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) stack.push(idx - 1);
    if (x < w - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - w);
    if (y < h - 1) stack.push(idx + w);
  }
}

export async function removeImageBackground(
  file: File | Blob,
  { threshold = 48, cutCenter = true }: RemoveBgOptions = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není dostupný");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const visited = new Uint8Array(w * h);

  // Outer background: seed every border pixel.
  const outerSeeds: number[] = [];
  for (let x = 0; x < w; x++) {
    outerSeeds.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    outerSeeds.push(y * w, y * w + w - 1);
  }
  floodErase(data, w, h, outerSeeds, threshold, visited);

  // Inner hole: seed the centre area.
  if (cutCenter) {
    const cx = (w / 2) | 0;
    const cy = (h / 2) | 0;
    const centerSeeds: number[] = [];
    const r = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        centerSeeds.push((cy + dy) * w + (cx + dx));
      }
    }
    floodErase(data, w, h, centerSeeds, threshold, new Uint8Array(w * h));
  }

  // Soften halo: fade pixels that are still dark but adjacent to transparency.
  ctx.putImageData(img, 0, 0);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export selhal"))), "image/png"),
  );
}

/** Crops fully transparent margins so the badge scales predictably. */
export async function trimTransparent(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const { width: w, height: h } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return blob;
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  if (cw === w && ch === h) return blob;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return await new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b ?? blob), "image/png"));
}
