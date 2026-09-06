import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function CommunityBackgroundRemoval() {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceObjectUrlRef = useRef<string | null>(null);
  const resultObjectUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    if (sourceObjectUrlRef.current) URL.revokeObjectURL(sourceObjectUrlRef.current);
    if (resultObjectUrlRef.current) URL.revokeObjectURL(resultObjectUrlRef.current);
  }, []);

  const replaceSourceUrl = (next: string | null) => {
    const previous = sourceObjectUrlRef.current;
    if (previous && previous !== next) URL.revokeObjectURL(previous);
    sourceObjectUrlRef.current = next;
    setSourceUrl(next);
  };

  const replaceResultUrl = (next: string | null) => {
    const previous = resultObjectUrlRef.current;
    if (previous && previous !== next) URL.revokeObjectURL(previous);
    resultObjectUrlRef.current = next;
    setResultUrl(next);
  };

  const choose = (next: File | null) => {
    if (!next || working) return;
    if (!next.type.startsWith("image/")) return toast.error("Vyber obrázek PNG, JPG nebo WEBP.");
    setFile(next);
    replaceSourceUrl(URL.createObjectURL(next));
    replaceResultUrl(null);
  };

  const reset = () => {
    if (working) return;
    replaceSourceUrl(null);
    replaceResultUrl(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async () => {
    if (!file || working) return;
    setWorking(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const output = await removeBackground(file, {
        output: { format: "image/png", quality: 1 },
      });
      const nextResultUrl = URL.createObjectURL(output);
      if (!mountedRef.current) {
        URL.revokeObjectURL(nextResultUrl);
        return;
      }
      replaceResultUrl(nextResultUrl);
      toast.success("Pozadí bylo odstraněno.");
    } catch (error) {
      console.error(error);
      if (mountedRef.current) toast.error(`Odstranění pozadí selhalo: ${error instanceof Error ? error.message : "neznámá chyba"}`);
    } finally {
      if (mountedRef.current) setWorking(false);
    }
  };

  const downloadName = file ? `${file.name.replace(/\.[^.]+$/, "")}-bez-pozadi.png` : "voxar-bez-pozadi.png";

  return (
    <div className="sv-feature-page sv-bg-page">
      <div className="sv-feature-toolbar">
        <div>
          <span className="sv-feature-kicker">VOXAR CREATOR TOOL</span>
          <h2>Odstranit pozadí</h2>
          <p>Lokální nástroj pro transparentní PNG. Obrázek zpracovává přímo tvoje zařízení.</p>
        </div>
        {file && <button type="button" className="sv-hud-button secondary" disabled={working} onClick={reset}><RotateCcw /> Nový obrázek</button>}
      </div>

      {!sourceUrl ? (
        <button type="button" className="sv-bg-drop" disabled={working} onClick={() => inputRef.current?.click()}>
          <span className="sv-bg-orb"><ImagePlus /></span>
          <strong>Vyber obrázek</strong>
          <span>PNG · JPG · WEBP</span>
        </button>
      ) : (
        <div className="sv-bg-workspace">
          <section className="sv-bg-preview-card">
            <header><span>01</span><strong>Originál</strong></header>
            <div className="sv-bg-preview"><img src={sourceUrl} alt="Původní obrázek" /></div>
          </section>

          <div className="sv-bg-action-column">
            <span className="sv-bg-process-line" />
            <button type="button" className="sv-bg-process" disabled={working} onClick={() => void remove()}>
              {working ? <Loader2 className="spin" /> : <Sparkles />}
              <strong>{working ? "Zpracovávám…" : "Odstranit pozadí"}</strong>
              <small>{working ? "První spuštění může stáhnout AI model." : "AI běží lokálně v aplikaci"}</small>
            </button>
          </div>

          <section className={`sv-bg-preview-card result${resultUrl ? " ready" : ""}`}>
            <header><span>02</span><strong>Výsledek</strong></header>
            <div className="sv-bg-preview transparent-grid">
              {resultUrl ? <img src={resultUrl} alt="Obrázek bez pozadí" /> : <div className="sv-bg-await"><Sparkles /><span>Výsledek se objeví tady</span></div>}
            </div>
            {resultUrl && (
              <a className="sv-hud-button download" href={resultUrl} download={downloadName}><Download /> Stáhnout PNG</a>
            )}
          </section>
        </div>
      )}

      <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0] ?? null)} />
    </div>
  );
}
