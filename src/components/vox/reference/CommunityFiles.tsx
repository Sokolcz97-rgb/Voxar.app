import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, File, FileImage, FileText, Loader2, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MAX_ATTACHMENT_BYTES } from "@/lib/uploadAttachment";

const BUCKET = "forum-attachments";

type StoredFile = {
  id?: string | null;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: { size?: number; mimetype?: string } | null;
};

const humanSize = (bytes = 0) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const safeName = (name: string) => name.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 100);

function FileGlyph({ mime, name }: { mime?: string; name: string }) {
  if (mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) return <FileImage />;
  if (mime?.startsWith("text/") || /\.(txt|md|json|csv)$/i.test(name)) return <FileText />;
  return <File />;
}

export function CommunityFiles() {
  const { user } = useAuth();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const prefix = user ? `${user.id}/files` : "";

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) toast.error(`Soubory nelze načíst: ${error.message}`);
    setFiles(((data ?? []) as StoredFile[]).filter((item) => item.name !== ".emptyFolderPlaceholder"));
    setLoading(false);
  }, [prefix, user]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (incoming: FileList | File[]) => {
    if (!user) return;
    const list = Array.from(incoming);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const source of list) {
        if (source.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${source.name}: limit je 25 MB.`);
          continue;
        }
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName(source.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(`${prefix}/${name}`, source, {
          cacheControl: "3600",
          contentType: source.type || undefined,
          upsert: false,
        });
        if (error) toast.error(`${source.name}: ${error.message}`);
        else toast.success(`${source.name} byl nahrán.`);
      }
      await load();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openFile = (item: StoredFile, download = false) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${prefix}/${item.name}`, {
      download: download ? item.name.replace(/^\d+-[a-z0-9]+-/, "") : false,
    });
    if (data.publicUrl) window.open(data.publicUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (item: StoredFile) => {
    if (!confirm(`Smazat soubor „${item.name.replace(/^\d+-[a-z0-9]+-/, "“)}“?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([`${prefix}/${item.name}`]);
    if (error) return toast.error(error.message);
    setFiles((current) => current.filter((file) => file.name !== item.name));
    toast.success("Soubor byl odstraněn.");
  };

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("cs");
    return q ? files.filter((item) => item.name.toLocaleLowerCase("cs").includes(q)) : files;
  }, [files, query]);

  return (
    <div className="sv-feature-page sv-files-page">
      <div className="sv-feature-toolbar">
        <div>
          <span className="sv-feature-kicker">VOXAR CLOUDSPACE</span>
          <h2>Soubory</h2>
          <p>Osobní prostor pro soubory, které používáš v komunitě a při tvorbě.</p>
        </div>
        <div className="sv-feature-toolbar-actions">
          <button type="button" className="sv-hud-button secondary" onClick={() => void load()}><RefreshCw /> Obnovit</button>
          <button type="button" className="sv-hud-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="spin" /> : <UploadCloud />} Nahrát soubory
          </button>
          <input ref={inputRef} type="file" multiple hidden onChange={(event) => void upload(event.target.files ?? [])} />
        </div>
      </div>

      <div
        className={`sv-file-drop${dragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
      >
        <UploadCloud />
        <strong>Přetáhni soubory sem</strong>
        <span>nebo klikni pro výběr · maximálně 25 MB na soubor</span>
      </div>

      <div className="sv-file-list-card">
        <div className="sv-file-list-head">
          <div><strong>Moje soubory</strong><span>{files.length} položek</span></div>
          <label className="sv-feature-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat soubor…" /></label>
        </div>

        {loading ? (
          <div className="sv-feature-loading"><Loader2 className="spin" /> Načítám soubory…</div>
        ) : visible.length === 0 ? (
          <div className="sv-feature-empty"><File /><strong>{query ? "Nic nenalezeno" : "Prostor je zatím prázdný"}</strong><span>Nahraj první soubor a objeví se tady.</span></div>
        ) : (
          <div className="sv-file-rows">
            {visible.map((item) => {
              const originalName = item.name.replace(/^\d+-[a-z0-9]+-/, "");
              const when = item.updated_at || item.created_at;
              return (
                <div className="sv-file-row" key={item.id || item.name}>
                  <button className="sv-file-main" type="button" onClick={() => openFile(item)}>
                    <span className="sv-file-icon"><FileGlyph mime={item.metadata?.mimetype} name={item.name} /></span>
                    <span className="sv-file-copy"><strong>{originalName}</strong><small>{humanSize(item.metadata?.size)}{when ? ` · ${new Date(when).toLocaleString("cs-CZ")}` : ""}</small></span>
                  </button>
                  <div className="sv-file-actions">
                    <button type="button" title="Stáhnout" onClick={() => openFile(item, true)}><Download /></button>
                    <button type="button" title="Smazat" className="danger" onClick={() => void remove(item)}><Trash2 /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
