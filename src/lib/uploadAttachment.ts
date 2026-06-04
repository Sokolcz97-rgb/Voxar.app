import { supabase } from "@/integrations/supabase/client";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

// Long-lived signed URL — bucket is private, ale embedované URLs ve fórových
// postech musí zůstat funkční bez per-request resolvingu.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 let

export const ALLOWED_MIME = new Set<string>([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf", "application/zip", "text/plain",
]);

export type UploadKind = "image" | "video" | "file";

export function detectKind(mime: string): UploadKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export interface UploadedAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: UploadKind;
}

export async function uploadAttachment(file: File, userId: string): Promise<UploadedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Soubor je větší než 25 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Nepodporovaný typ souboru: ${file.type || "neznámý"}`);
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 60);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`.replace(/\.[^.]+$/, "") + "." + ext;

  const { error } = await supabase.storage
    .from("forum-attachments")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from("forum-attachments")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    throw signErr ?? new Error("Nepodařilo se vytvořit URL přílohy");
  }

  return {
    url: signed.signedUrl,
    name: file.name,
    mime: file.type,
    size: file.size,
    kind: detectKind(file.type),
  };
}
