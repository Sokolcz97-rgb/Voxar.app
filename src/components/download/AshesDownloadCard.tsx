import { useCallback, useEffect, useRef, useState } from "react";
import { Download as DownloadIcon, Lock, Upload, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ashes of Eryon – interní stahování jen pro administrátory.
 *
 * Instalátor leží v privátním bucketu `game-builds`; přístup hlídá RLS
 * (has_role(auth.uid(), 'admin')), takže ostatní uživatelé k souborům nemají
 * přístup ani přímým odkazem. Soubor je rozdělený na části (limit velikosti
 * jednoho souboru ve Storage) a v prohlížeči se po stažení složí zpět a ověří
 * přes SHA-256.
 */

const BUCKET = "game-builds";
const MANIFEST_PATH = "ashes/latest.json";
const PART_SIZE = 45 * 1024 * 1024;

type Manifest = {
  version: string;
  fileName: string;
  size: number;
  sha256: string;
  parts: string[];
  uploadedAt: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} GB` : `${mb.toFixed(1).replace(".", ",")} MB`;
}

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function AshesDownloadCard() {
  const { isAdmin, loading } = useAuth();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestState, setManifestState] = useState<"idle" | "loading" | "missing" | "ready">("idle");
  const [busy, setBusy] = useState<null | "download" | "upload">(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadVersion, setUploadVersion] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadManifest = useCallback(async () => {
    setManifestState("loading");
    const { data, error } = await supabase.storage.from(BUCKET).download(MANIFEST_PATH);
    if (error || !data) {
      setManifest(null);
      setManifestState("missing");
      return;
    }
    try {
      setManifest(JSON.parse(await data.text()) as Manifest);
      setManifestState("ready");
    } catch {
      setManifest(null);
      setManifestState("missing");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadManifest();
  }, [isAdmin, loadManifest]);

  const download = async () => {
    if (!manifest) return;
    setBusy("download");
    setMessage(null);
    setProgress(0);
    try {
      const chunks: Blob[] = [];
      for (let index = 0; index < manifest.parts.length; index += 1) {
        const { data, error } = await supabase.storage.from(BUCKET).download(manifest.parts[index]);
        if (error || !data) throw new Error("Část instalátoru se nepodařilo stáhnout.");
        chunks.push(data);
        setProgress((index + 1) / manifest.parts.length);
      }
      const file = new Blob(chunks, { type: "application/octet-stream" });
      if (file.size !== manifest.size) throw new Error("Stažený soubor nemá očekávanou velikost.");
      setMessage("Ověřuji kontrolní součet…");
      const hash = await sha256Hex(await file.arrayBuffer());
      if (hash !== manifest.sha256.toLowerCase()) throw new Error("Kontrolní součet nesouhlasí – soubor je poškozený.");
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = manifest.fileName || "GameSetup.exe";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("Hotovo – instalátor je ověřený a uložený.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Stažení se nepodařilo.");
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File) => {
    const version = uploadVersion.trim() || new Date().toISOString().slice(0, 10);
    setBusy("upload");
    setMessage("Počítám kontrolní součet…");
    setProgress(0);
    try {
      const sha256 = await sha256Hex(await file.arrayBuffer());
      const parts: string[] = [];
      const count = Math.ceil(file.size / PART_SIZE);
      for (let index = 0; index < count; index += 1) {
        const path = `ashes/${version}/GameSetup.exe.part${String(index).padStart(3, "0")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file.slice(index * PART_SIZE, (index + 1) * PART_SIZE), {
          upsert: true,
          contentType: "application/octet-stream",
        });
        if (error) throw new Error(`Nahrání části ${index + 1}/${count} selhalo: ${error.message}`);
        parts.push(path);
        setProgress((index + 1) / count);
        setMessage(`Nahrávám ${index + 1}/${count}…`);
      }
      const next: Manifest = { version, fileName: "GameSetup.exe", size: file.size, sha256, parts, uploadedAt: new Date().toISOString() };
      const { error } = await supabase.storage.from(BUCKET).upload(MANIFEST_PATH, new Blob([JSON.stringify(next, null, 2)], { type: "application/json" }), {
        upsert: true,
        cacheControl: "0",
        contentType: "application/json",
      });
      if (error) throw new Error(`Uložení popisu verze selhalo: ${error.message}`);
      setMessage(`Verze ${version} je nahraná.`);
      await loadManifest();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nahrání se nepodařilo.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Card className="mb-10 overflow-hidden border-amber-500/30 bg-card/80 relative">
      <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: "url(/game/ashes-card-bg.webp)" }} aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" aria-hidden />
      <div className="relative grid md:grid-cols-[260px_1fr] gap-6 p-6 items-center">
        <img src="/game/ashes-logo.webp" alt="Ashes of Eryon" className="w-56 mx-auto drop-shadow-[0_8px_20px_rgba(0,0,0,.8)]" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-amber-400 mb-1">Hra · StudioVoxario</div>
          <h2 className="text-2xl font-semibold text-amber-50">Ashes of Eryon</h2>
          <p className="text-sm text-amber-100/70 mt-1 max-w-xl">
            Temné fantasy RPG s vlastním launcherem. Instalátor připraví launcher, přes který se bude hra stahovat a aktualizovat.
          </p>

          {loading ? null : !isAdmin ? (
            <Button size="lg" className="mt-5 w-full md:w-auto" disabled>
              <Lock className="h-4 w-4 mr-2" />
              Připravuje se…
            </Button>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" variant="hero" className="btn-3d" onClick={download} disabled={busy !== null || manifestState !== "ready"}>
                  {busy === "download" ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <DownloadIcon className="h-5 w-5 mr-2" />}
                  {busy === "download" ? `Stahuji ${Math.round(progress * 100)} %` : "Stáhnout GameSetup.exe"}
                </Button>
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-200/80">
                  <ShieldCheck className="h-4 w-4" /> Viditelné jen pro administrátory
                </span>
              </div>
              <p className="text-xs text-amber-100/60">
                {manifestState === "loading" && "Načítám informace o verzi…"}
                {manifestState === "missing" && "Zatím není nahraná žádná verze instalátoru."}
                {manifestState === "ready" && manifest &&
                  `Verze ${manifest.version} · ${formatBytes(manifest.size)} · nahráno ${new Date(manifest.uploadedAt).toLocaleString("cs-CZ")} · SHA-256 ${manifest.sha256.slice(0, 12)}…`}
              </p>
              <details className="text-xs text-amber-100/70">
                <summary className="cursor-pointer select-none">Nahrát novou verzi</summary>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="h-9 rounded-md border border-amber-500/30 bg-black/50 px-3 text-sm text-amber-50"
                    placeholder="Verze, např. 0.1.0-alpha"
                    value={uploadVersion}
                    onChange={(event) => setUploadVersion(event.target.value)}
                  />
                  <input ref={fileInput} type="file" accept=".exe" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
                    {busy === "upload" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {busy === "upload" ? `Nahrávám ${Math.round(progress * 100)} %` : "Vybrat GameSetup.exe"}
                  </Button>
                </div>
              </details>
              {message && <p className="text-sm text-amber-100">{message}</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
