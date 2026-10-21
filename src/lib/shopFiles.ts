import { supabase } from "@/integrations/supabase/client";

/** Soubory softwaru v obchodě (soukromý bucket, části do 45 MB – limit úložiště je 50 MB). */
export const SHOP_BUCKET = "shop-files";
const PART_SIZE = 45 * 1024 * 1024;

export async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatBytes(bytes?: number | null) {
  if (!bytes || !Number.isFinite(bytes)) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} GB` : `${mb.toFixed(1).replace(".", ",")} MB`;
}

/** Doba přístupu v minutách → čitelný text („7 dní“, „12 hodin“). */
export function formatDuration(minutes?: number | null) {
  const m = Math.max(0, Math.round(minutes ?? 0));
  if (m === 0) return "—";
  const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
  if (m % (30 * 24 * 60) === 0) return plural(m / (30 * 24 * 60), "měsíc", "měsíce", "měsíců");
  if (m % (7 * 24 * 60) === 0) return plural(m / (7 * 24 * 60), "týden", "týdny", "týdnů");
  if (m % (24 * 60) === 0) return plural(m / (24 * 60), "den", "dny", "dní");
  if (m % 60 === 0) return plural(m / 60, "hodina", "hodiny", "hodin");
  return plural(m, "minuta", "minuty", "minut");
}

/** Zbývající čas do konce přístupu. */
export function formatRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "vypršelo";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} dní ${h % 24} h`;
}

/** Nahraje soubor po částech k položce obchodu. Vrací údaje k uložení do shop_items. */
export async function uploadShopFile(itemId: string, file: File, onProgress: (k: number, msg: string) => void) {
  onProgress(0, "Počítám kontrolní součet…");
  const sha256 = await sha256Hex(await file.arrayBuffer());
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const count = Math.max(1, Math.ceil(file.size / PART_SIZE));
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const path = `${itemId}/${stamp}/${safe}.part${String(i).padStart(3, "0")}`;
    const { error } = await supabase.storage.from(SHOP_BUCKET).upload(path, file.slice(i * PART_SIZE, (i + 1) * PART_SIZE), {
      upsert: true,
      contentType: "application/octet-stream",
    });
    if (error) throw new Error(`Nahrání části ${i + 1}/${count} selhalo: ${error.message}`);
    parts.push(path);
    onProgress((i + 1) / count, `Nahrávám ${i + 1}/${count}…`);
  }
  return { file_name: file.name, file_size: file.size, file_sha256: sha256, file_parts: parts, file_uploaded_at: new Date().toISOString() };
}

/** Smaže staré části souboru (po nahrání nové verze). */
export async function removeShopFiles(parts: string[] | null | undefined) {
  if (!parts?.length) return;
  await supabase.storage.from(SHOP_BUCKET).remove(parts);
}

/** Stáhne soubor (části) a uloží ho v prohlížeči. Úložiště pustí jen hráče s aktivním přístupem. */
export async function downloadShopFile(
  item: { file_parts?: string[] | null; file_name?: string | null; file_sha256?: string | null },
  onProgress: (k: number) => void,
) {
  const parts = item.file_parts ?? [];
  if (!parts.length) throw new Error("Soubor zatím není nahraný.");
  const blobs: Blob[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const { data, error } = await supabase.storage.from(SHOP_BUCKET).download(parts[i]);
    if (error || !data) throw new Error("Stažení se nezdařilo – přístup možná vypršel.");
    blobs.push(data);
    onProgress((i + 1) / parts.length);
  }
  const blob = new Blob(blobs, { type: "application/octet-stream" });
  if (item.file_sha256) {
    const hash = await sha256Hex(await blob.arrayBuffer());
    if (hash !== item.file_sha256) throw new Error("Soubor se stáhl poškozený, zkus to prosím znovu.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.file_name || "Setup.exe";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
