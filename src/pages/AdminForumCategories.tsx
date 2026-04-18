import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  thread_count?: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const AdminForumCategories = () => {
  const { can, loading: permsLoading } = usePermissions();
  const allowed = can("forum", "manage_categories");

  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forum_categories")
      .select("*")
      .order("position");
    if (data) {
      const enriched = await Promise.all(
        data.map(async (c) => {
          const { count } = await supabase
            .from("forum_threads")
            .select("*", { count: "exact", head: true })
            .eq("category_id", c.id);
          return { ...c, thread_count: count ?? 0 };
        })
      );
      setCats(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDescription("");
    setSlugTouched(false);
    setOpenForm(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description ?? "");
    setSlugTouched(true);
    setOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("forum_categories")
        .update({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Kategorie upravena");
    } else {
      const nextPos = cats.length ? Math.max(...cats.map((c) => c.position)) + 1 : 0;
      const { error } = await supabase.from("forum_categories").insert({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        position: nextPos,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Kategorie vytvořena");
    }
    setOpenForm(false);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if ((confirmDelete.thread_count ?? 0) > 0) {
      toast.error("Kategorie obsahuje vlákna a nelze ji smazat.");
      setConfirmDelete(null);
      return;
    }
    const { error } = await supabase
      .from("forum_categories")
      .delete()
      .eq("id", confirmDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Kategorie smazána");
      load();
    }
    setConfirmDelete(null);
  };

  const move = async (c: Category, dir: -1 | 1) => {
    const idx = cats.findIndex((x) => x.id === c.id);
    const swap = cats[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("forum_categories").update({ position: swap.position }).eq("id", c.id),
      supabase.from("forum_categories").update({ position: c.position }).eq("id", swap.id),
    ]);
    load();
  };

  if (permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link
          to="/admin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Zpět do administrace
        </Link>

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Fórum</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-2">
              Kategorie fóra
            </h1>
            <p className="text-muted-foreground mt-2">
              Vytvářej, upravuj a řaď diskuzní kategorie.
            </p>
          </div>
          <Button
            onClick={openNew}
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
          >
            <Plus className="h-4 w-4 mr-1" /> Nová kategorie
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : cats.length === 0 ? (
          <Card className="glass border-border p-10 text-center text-muted-foreground">
            Zatím nejsou žádné kategorie. Vytvoř první.
          </Card>
        ) : (
          <div className="space-y-3">
            {cats.map((c, i) => (
              <Card
                key={c.id}
                className="glass border-border p-5 flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold">{c.name}</h3>
                    <code className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      /{c.slug}
                    </code>
                  </div>
                  {c.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 mr-2">
                  <div className="font-display font-bold text-primary">
                    {c.thread_count}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    vláken
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => move(c, -1)}
                    title="Posunout nahoru"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === cats.length - 1}
                    onClick={() => move(c, 1)}
                    title="Posunout dolů"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(c)}
                    title="Upravit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirmDelete(c)}
                    title="Smazat"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="glass border-border">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upravit kategorii" : "Nová kategorie"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Název</Label>
              <Input
                id="cat-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug (URL)</Label>
              <Input
                id="cat-slug"
                required
                maxLength={60}
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugTouched(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Zobrazí se v URL: /forum/{slug || "..."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Popis (volitelné)</Label>
              <Textarea
                id="cat-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenForm(false)}
              >
                Zrušit
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary-glow"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat kategorii?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategorie „{confirmDelete?.name}" bude trvale odstraněna.
              {(confirmDelete?.thread_count ?? 0) > 0 && (
                <>
                  {" "}
                  <strong className="text-destructive">
                    Obsahuje {confirmDelete?.thread_count} vláken — nejprve je
                    přesuň nebo smaž.
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminForumCategories;
