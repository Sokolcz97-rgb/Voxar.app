import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, Trash2, Pencil, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { PageRow } from "@/hooks/usePages";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const RESERVED = new Set([
  "auth", "dashboard", "profile", "admin", "forum", "messages",
  "tickets", "leaderboard", "home",
]);

export default function AdminPages() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<PageRow | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [navLabel, setNavLabel] = useState("");
  const [navPos, setNavPos] = useState(100);
  const [published, setPublished] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("pages").select("*").order("nav_position");
    setPages((data as unknown as PageRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setTitle(""); setSlug(""); setNavLabel(""); setNavPos(100); setPublished(true);
    setCreateOpen(true);
  };
  const openEdit = (p: PageRow) => {
    setTitle(p.title); setSlug(p.slug); setNavLabel(p.nav_label ?? "");
    setNavPos(p.nav_position); setPublished(p.is_published);
    setEditOpen(p);
  };

  const handleCreate = async () => {
    if (!title.trim() || !slug.trim()) { toast({ title: "Vyplň název a slug", variant: "destructive" }); return; }
    const finalSlug = slugify(slug);
    if (RESERVED.has(finalSlug)) {
      toast({ title: `Slug "${finalSlug}" je rezervovaný pro aplikaci`, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("pages").insert({
      title: title.trim(), slug: slugify(slug), nav_label: navLabel.trim() || null,
      nav_position: navPos, is_published: published,
    } as any);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Stránka vytvořena" });
    setCreateOpen(false); load();
  };

  const handleUpdate = async () => {
    if (!editOpen) return;
    const patch: any = {
      title: title.trim(),
      nav_label: navLabel.trim() || null,
      nav_position: navPos,
      is_published: published,
    };
    if (!editOpen.is_system && slug && slug !== editOpen.slug) patch.slug = slugify(slug);
    const { error } = await supabase.from("pages").update(patch).eq("id", editOpen.id);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Uloženo" });
    setEditOpen(null); load();
  };

  const handleDelete = async (p: PageRow) => {
    if (p.is_system) return;
    if (!confirm(`Smazat stránku "${p.title}"?`)) return;
    const { error } = await supabase.from("pages").delete().eq("id", p.id);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Smazáno" }); load();
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
            <h1 className="font-display font-black text-4xl md:text-5xl mt-2">Page Builder</h1>
            <p className="text-muted-foreground mt-2">Spravuj stránky, vytvářej podstránky a přepínej publikování.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                <Plus className="h-4 w-4 mr-2" /> Nová stránka
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nová stránka</DialogTitle></DialogHeader>
              <PageForm
                title={title} setTitle={(v) => { setTitle(v); if (!slug) setSlug(slugify(v)); }}
                slug={slug} setSlug={setSlug}
                navLabel={navLabel} setNavLabel={setNavLabel}
                navPos={navPos} setNavPos={setNavPos}
                published={published} setPublished={setPublished}
                slugLocked={false}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Zrušit</Button>
                <Button onClick={handleCreate}>Vytvořit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítám…</p>
        ) : (
          <div className="grid gap-3">
            {pages.map((p) => (
              <Card key={p.id} className="glass border-border p-5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-lg truncate">{p.title}</h3>
                    {p.is_system && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Systémová</Badge>}
                    {p.is_published
                      ? <Badge className="bg-primary/20 text-primary border-primary/40">Publikováno</Badge>
                      : <Badge variant="outline">Koncept</Badge>}
                    {p.nav_label && <Badge variant="secondary">v menu: {p.nav_label}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    /{p.slug === "home" ? "" : p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={p.slug === "home" ? "/" : `/${p.slug}`}>
                      <ExternalLink className="h-4 w-4 mr-1" /> Otevřít
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4 mr-1" /> Upravit
                  </Button>
                  {!p.is_system && (
                    <Button variant="outline" size="icon" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upravit stránku</DialogTitle></DialogHeader>
            {editOpen && (
              <PageForm
                title={title} setTitle={setTitle}
                slug={slug} setSlug={setSlug}
                navLabel={navLabel} setNavLabel={setNavLabel}
                navPos={navPos} setNavPos={setNavPos}
                published={published} setPublished={setPublished}
                slugLocked={editOpen.is_system}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(null)}>Zrušit</Button>
              <Button onClick={handleUpdate}>Uložit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function PageForm(props: {
  title: string; setTitle: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  navLabel: string; setNavLabel: (v: string) => void;
  navPos: number; setNavPos: (v: number) => void;
  published: boolean; setPublished: (v: boolean) => void;
  slugLocked: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Název stránky (SEO title)</Label>
        <Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} />
      </div>
      <div>
        <Label>Slug (URL adresa) {props.slugLocked && <span className="text-xs text-muted-foreground">— systémová, nelze měnit</span>}</Label>
        <Input value={props.slug} onChange={(e) => props.setSlug(e.target.value)} disabled={props.slugLocked} />
        <p className="text-xs text-muted-foreground mt-1">Bude dostupná na /{props.slug}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Popisek v menu (volitelné)</Label>
          <Input value={props.navLabel} onChange={(e) => props.setNavLabel(e.target.value)} placeholder="Nezobrazovat = prázdné" />
        </div>
        <div>
          <Label>Pořadí v menu</Label>
          <Input type="number" value={props.navPos} onChange={(e) => props.setNavPos(Number(e.target.value) || 0)} />
        </div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-md border border-border">
        <div>
          <Label>Publikováno</Label>
          <p className="text-xs text-muted-foreground">Vypnutí skryje stránku před návštěvníky</p>
        </div>
        <Switch checked={props.published} onCheckedChange={props.setPublished} />
      </div>
    </div>
  );
}
