import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "info" | "warning" | "success" | "highlight";

interface Announcement {
  id: string;
  title: string | null;
  body: string;
  variant: Variant;
  is_active: boolean;
  link_url: string | null;
  link_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

const variantStyles: Record<Variant, { wrap: string; icon: JSX.Element; label: string }> = {
  info: {
    wrap: "border-primary/40 bg-primary/5",
    icon: <Info className="h-4 w-4 text-primary" />,
    label: "Info",
  },
  warning: {
    wrap: "border-yellow-500/40 bg-yellow-500/5",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    label: "Varování",
  },
  success: {
    wrap: "border-emerald-500/40 bg-emerald-500/5",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    label: "Úspěch",
  },
  highlight: {
    wrap: "border-accent/40 bg-accent/5",
    icon: <Sparkles className="h-4 w-4 text-accent" />,
    label: "Novinka",
  },
};

const DISMISSED_KEY = "svx.dismissedAnnouncements";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function AnnouncementBar() {
  const { isAdmin, isEditor } = useAuth();
  const canManage = isAdmin || isEditor;
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const load = async () => {
    const query = supabase
      .from("site_announcements")
      .select("*")
      .order("sort_order", { ascending: false })
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) return;
    setItems((data ?? []) as Announcement[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("site_announcements_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_announcements" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  const now = Date.now();
  const visible = items.filter((a) => {
    if (!canManage) {
      if (!a.is_active) return false;
      if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
      if (a.ends_at && new Date(a.ends_at).getTime() <= now) return false;
      if (dismissed.includes(a.id)) return false;
    }
    return true;
  });

  const openNew = () => {
    setEditing({
      id: "",
      title: "",
      body: "",
      variant: "info",
      is_active: true,
      link_url: "",
      link_label: "",
      starts_at: null,
      ends_at: null,
      sort_order: 0,
    });
    setEditorOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing({ ...a });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.body.trim()) {
      toast.error("Text oznámení nesmí být prázdný");
      return;
    }
    const payload = {
      title: editing.title || null,
      body: editing.body,
      variant: editing.variant,
      is_active: editing.is_active,
      link_url: editing.link_url || null,
      link_label: editing.link_label || null,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
      sort_order: editing.sort_order,
    };
    if (editing.id) {
      const { error } = await supabase
        .from("site_announcements")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Oznámení uloženo");
    } else {
      const { error } = await supabase.from("site_announcements").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Oznámení vytvořeno");
    }
    setEditorOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Smazat toto oznámení?")) return;
    const { error } = await supabase.from("site_announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    load();
  };

  const toggleActive = async (a: Announcement) => {
    const { error } = await supabase
      .from("site_announcements")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) toast.error(error.message);
  };

  if (visible.length === 0 && !canManage) return null;

  return (
    <>
      <section className="container pt-6">
        {canManage && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5 text-primary" />
              Oznámení ({items.length})
            </div>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nové oznámení
            </Button>
          </div>
        )}

        {visible.length > 0 && (
          <div className="space-y-2">
            {visible.map((a) => {
              const v = variantStyles[a.variant] ?? variantStyles.info;
              const isExpired =
                (a.ends_at && new Date(a.ends_at).getTime() <= now) ||
                (a.starts_at && new Date(a.starts_at).getTime() > now);
              return (
                <div
                  key={a.id}
                  className={cn(
                    "relative flex items-start gap-3 rounded-xl border backdrop-blur-sm px-4 py-3 md:px-5 md:py-4",
                    v.wrap,
                    !a.is_active && "opacity-60",
                  )}
                >
                  <div className="pt-0.5">{v.icon}</div>
                  <div className="flex-1 min-w-0">
                    {a.title && (
                      <div className="font-display font-semibold text-sm md:text-base leading-tight mb-0.5">
                        {a.title}
                      </div>
                    )}
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                      {a.body}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {a.link_url && (
                        <a
                          href={a.link_url}
                          target={a.link_url.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {a.link_label || "Zjistit více"}{" "}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {canManage && (
                        <>
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {v.label}
                          </span>
                          {!a.is_active && (
                            <span className="text-[10px] uppercase tracking-widest text-yellow-500">
                              Neaktivní
                            </span>
                          )}
                          {isExpired && a.is_active && (
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              Mimo platnost
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={a.is_active}
                        onCheckedChange={() => toggleActive(a)}
                        aria-label="Aktivní"
                      />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(a.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => dismiss(a.id)}
                      className="p-1 rounded hover:bg-foreground/5 text-muted-foreground"
                      aria-label="Zavřít"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canManage && (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing?.id ? "Upravit oznámení" : "Nové oznámení"}
              </DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div>
                  <Label>Nadpis (volitelné)</Label>
                  <Input
                    value={editing.title ?? ""}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    placeholder="Např. Nová aktualita"
                  />
                </div>
                <div>
                  <Label>Text *</Label>
                  <Textarea
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    rows={4}
                    placeholder="Obsah oznámení…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Typ</Label>
                    <Select
                      value={editing.variant}
                      onValueChange={(v) =>
                        setEditing({ ...editing, variant: v as Variant })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="highlight">Novinka</SelectItem>
                        <SelectItem value="success">Úspěch</SelectItem>
                        <SelectItem value="warning">Varování</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pořadí (vyšší = výše)</Label>
                    <Input
                      type="number"
                      value={editing.sort_order}
                      onChange={(e) =>
                        setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Text odkazu</Label>
                    <Input
                      value={editing.link_label ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, link_label: e.target.value })
                      }
                      placeholder="Zjistit více"
                    />
                  </div>
                  <div>
                    <Label>URL odkazu</Label>
                    <Input
                      value={editing.link_url ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, link_url: e.target.value })
                      }
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Zobrazovat od</Label>
                    <Input
                      type="datetime-local"
                      value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          starts_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Zobrazovat do</Label>
                    <Input
                      type="datetime-local"
                      value={editing.ends_at ? editing.ends_at.slice(0, 16) : ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label>Aktivní</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={save}>Uložit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
