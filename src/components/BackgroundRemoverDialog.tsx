import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Eraser, Image as ImageIcon, Loader2, Upload, Check } from "lucide-react";
import { toast } from "sonner";

export const BG_MAX_BYTES = 5 * 1024 * 1024;
export const BG_MAX_W = 1920;
export const BG_MAX_H = 1080;

/** Validates size, then downscales the image so it fits into 1920x1080. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Soubor není obrázek.");
  if (file.size > BG_MAX_BYTES) throw new Error("Obrázek je větší než 5 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, BG_MAX_W / bitmap.width, BG_MAX_H / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není dostupný.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Zpracování selhalo."))), "image/png"),
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, an "use this image" action is shown. */
  onApply?: (file: File) => void | Promise<void>;
  applyLabel?: string;
}

export function BackgroundRemoverDialog({ open, onOpenChange, onApply, applyLabel = "Použít jako avatar" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [dims, setDims] = useState<string>("");

  const reset = () => {
    setSourceUrl(null);
    setResultUrl(null);
    setResultBlob(null);
    setDims("");
  };

  const handleFile = useCallback(async (file: File) => {
    reset();
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      setSourceUrl(URL.createObjectURL(prepared));
      const { removeBackground } = await import("@imgly/background-removal");
      const out = await removeBackground(prepared, { output: { format: "image/png" } });
      const bmp = await createImageBitmap(out);
      setDims(`${bmp.width} × ${bmp.height} px`);
      bmp.close?.();
      setResultBlob(out);
      setResultUrl(URL.createObjectURL(out));
    } catch (e: any) {
      toast.error(e?.message || "Odstranění pozadí selhalo.");
    } finally {
      setBusy(false);
    }
  }, []);

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `bez-pozadi-${Date.now()}.png`;
    a.click();
  };

  const apply = async () => {
    if (!resultBlob || !onApply) return;
    setApplying(true);
    try {
      await onApply(new File([resultBlob], `avatar-${Date.now()}.png`, { type: "image/png" }));
      onOpenChange(false);
      reset();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5 text-primary" /> Odstranit pozadí
          </DialogTitle>
          <DialogDescription>
            Nahraj obrázek (max. 5 MB). Větší obrázky se automaticky zmenší na maximálně 1920 × 1080 px.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleFile(f);
          }}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Originál</p>
            <div className="aspect-video border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
              {sourceUrl ? (
                <img src={sourceUrl} alt="Původní obrázek" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Bez pozadí</p>
            <div className="aspect-video border border-primary/30 bg-[conic-gradient(#0000_90deg,#ffffff0d_0_180deg,#0000_0_270deg,#ffffff0d_0)] bg-[length:16px_16px] flex items-center justify-center overflow-hidden">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : resultUrl ? (
                <img src={resultUrl} alt="Obrázek bez pozadí" className="max-h-full max-w-full object-contain" />
              ) : (
                <Eraser className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {dims && <p className="text-xs text-muted-foreground">Výsledek: {dims}</p>}
        {busy && <p className="text-xs text-muted-foreground">Zpracování probíhá přímo v prohlížeči, může chvíli trvat…</p>}

        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4 mr-2" /> Vybrat obrázek
          </Button>
          <Button type="button" variant="outline" onClick={download} disabled={!resultUrl || busy}>
            <Download className="h-4 w-4 mr-2" /> Stáhnout PNG
          </Button>
          {onApply && (
            <Button type="button" onClick={apply} disabled={!resultBlob || busy || applying}>
              {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {applyLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
