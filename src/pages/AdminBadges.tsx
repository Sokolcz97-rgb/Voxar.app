import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PageHero } from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { removeImageBackground, trimTransparent } from "@/lib/removeImageBackground";
import { useCosmeticStyles, type CosmeticStyle } from "@/hooks/useCosmeticStyles";
import { Loader2, Shapes, Trash2, Upload, Wand2 } from "lucide-react";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `badge_${Date.now()}`;

const AdminBadges = () => {
  const { styles, loading, refresh } = useCosmeticStyles();

  const [file, setFile] = useState<File | null>(null);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const processedBlob = useRef<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [removeBg, setRemoveBg] = useState(true);
  const [cutCenter, setCutCenter] = useState(true);
  const [threshold, setThreshold] = useState(48);
  const [scale, setScale] = useState(135);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(
    () => () => {
      if (origUrl) URL.revokeObjectURL(origUrl);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    },
    [origUrl, processedUrl],
  );

  const process = async (source: File, opts?: { threshold?: number; cut?: boolean; strip?: boolean }) => {
    setProcessing(true);
    try {
      let blob: Blob = source;
      if (opts?.strip ?? removeBg) {
        blob = await removeImageBackground(source, {
          threshold: opts?.threshold ?? threshold,
          cutCenter: opts?.cut ?? cutCenter,
        });
        blob = await trimTransparent(blob);
      }
      processedBlob.current = blob;
      setProcessedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      toast({
        title: "Zpracování selhalo",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const onPick = async (f: File | null) => {
    if (!f) return;
    setFile(f);
    setOrigUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    await process(f);
  };

  const save = async () => {
    if (!processedBlob.current || !name.trim()) {
      toast({ title: "Vyplň název a nahraj obrázek", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const id = slugify(name);
      const path = `${id}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("cosmetics")
        .upload(path, processedBlob.current, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("cosmetics")
        .createSignedUrl(path, TEN_YEARS);
      if (signErr || !signed) throw signErr ?? new Error("Nepodařilo se získat URL");

      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("cosmetic_styles").upsert(
        {
          id,
          name: name.trim(),
          description: description.trim() || null,
          image_url: signed.signedUrl,
          storage_path: path,
          scale,
          active: true,
          created_by: userRes.user?.id ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;

      toast({ title: "Badge uložen", description: `ID: ${id}` });
      setFile(null);
      setName("");
      setDescription("");
      processedBlob.current = null;
      setProcessedUrl(null);
      setOrigUrl(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Uložení selhalo",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: CosmeticStyle) => {
    await supabase.from("cosmetic_styles").update({ active: !s.active }).eq("id", s.id);
    await refresh();
  };

  const updateScale = async (s: CosmeticStyle, value: number) => {
    await supabase.from("cosmetic_styles").update({ scale: value }).eq("id", s.id);
    await refresh();
  };

  const remove = async (s: CosmeticStyle) => {
    if (!confirm(`Smazat badge „${s.name}“?`)) return;
    if (s.storage_path) await supabase.storage.from("cosmetics").remove([s.storage_path]);
    const { error } = await supabase.from("cosmetic_styles").delete().eq("id", s.id);
    if (error) {
      toast({ title: "Smazání selhalo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Badge smazán" });
    await refresh();
  };

  const previewScale = useMemo(() => `${scale}%`, [scale]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-5xl animate-fade-in">
        <PageHero
          eyebrow="Administrace"
          title="Badge & rámečky"
          description="Nahraj obrázek badge, automaticky mu odstraň pozadí i střed a publikuj ho do katalogu kosmetiky."
          icon={Shapes}
        />

        <Card className="glass border-border p-6 mb-6">
          <h3 className="font-display text-sm tracking-[0.2em] uppercase text-primary mb-4">
            Nahrát nový badge
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label htmlFor="badge-file">Obrázek (PNG / JPG)</Label>
                <Input
                  id="badge-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="cursor-pointer">Odstranit pozadí</Label>
                  <p className="text-xs text-muted-foreground">Smaže tmavé okolí emblému.</p>
                </div>
                <Switch
                  checked={removeBg}
                  onCheckedChange={(v) => {
                    setRemoveBg(v);
                    if (file) void process(file, { strip: v });
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="cursor-pointer">Vyříznout střed</Label>
                  <p className="text-xs text-muted-foreground">Díra pro profilovku uprostřed.</p>
                </div>
                <Switch
                  checked={cutCenter}
                  onCheckedChange={(v) => {
                    setCutCenter(v);
                    if (file) void process(file, { cut: v });
                  }}
                />
              </div>

              <div>
                <Label>Citlivost odstranění ({threshold})</Label>
                <Slider
                  value={[threshold]}
                  min={5}
                  max={160}
                  step={1}
                  onValueChange={(v) => setThreshold(v[0])}
                  onValueCommit={(v) => file && void process(file, { threshold: v[0] })}
                />
              </div>

              <div>
                <Label>Měřítko překryvu ({scale} %)</Label>
                <Slider
                  value={[scale]}
                  min={100}
                  max={320}
                  step={5}
                  onValueChange={(v) => setScale(v[0])}
                />
              </div>

              <div>
                <Label htmlFor="badge-name">Název</Label>
                <Input id="badge-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="badge-desc">Popis</Label>
                <Textarea
                  id="badge-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void save()} disabled={saving || processing || !processedUrl}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Uložit badge
                </Button>
                <Button
                  variant="outline"
                  disabled={!file || processing}
                  onClick={() => file && void process(file)}
                >
                  <Wand2 className="h-4 w-4" />
                  Přepočítat
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Původní</p>
                  <div className="aspect-square bg-card/40 border border-border/60 flex items-center justify-center overflow-hidden">
                    {origUrl ? (
                      <img src={origUrl} alt="Původní badge" className="max-h-full max-w-full" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    Zpracované
                  </p>
                  <div className="aspect-square border border-border/60 flex items-center justify-center overflow-hidden checkerboard">
                    {processing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : processedUrl ? (
                      <img src={processedUrl} alt="Zpracovaný badge" className="max-h-full max-w-full" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Náhled na avataru
                </p>
                <div className="flex items-center gap-8 p-6 bg-card/40 border border-border/60">
                  {[40, 64].map((size) => (
                    <span key={size} className="relative inline-flex isolate">
                      <span
                        className="relative z-0 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center font-display text-xs"
                        style={{ width: size, height: size }}
                      >
                        VX
                      </span>
                      {processedUrl && (
                        <img
                          src={processedUrl}
                          alt=""
                          aria-hidden
                          className="pointer-events-none absolute z-10 max-w-none"
                          style={{
                            width: previewScale,
                            height: previewScale,
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass border-border p-6">
          <h3 className="font-display text-sm tracking-[0.2em] uppercase text-primary mb-4">
            Nahrané badge
          </h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : styles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím nic nenahráno.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {styles.map((s) => (
                <li key={s.id} className="p-4 border border-border/60 bg-card/40 flex gap-4">
                  <UserAvatar name="VX" cosmeticId={s.id} className="h-12 w-12" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="font-display text-xs uppercase tracking-[0.18em] truncate">
                      {s.name}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {s.description || s.id}
                    </p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground">Měřítko</span>
                      <Input
                        type="number"
                        defaultValue={s.scale}
                        className="h-7 w-20"
                        onBlur={(e) => void updateScale(s, Number(e.target.value) || s.scale)}
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={s.active} onCheckedChange={() => void toggleActive(s)} />
                      <span className="text-[11px] text-muted-foreground">
                        {s.active ? "Aktivní" : "Skryté"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => void remove(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminBadges;
