import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { Block } from "@/lib/pageBuilder/types";
import { SHORTCODES } from "@/lib/pageBuilder/types";

export function BlockSettings({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const set = (patch: Partial<Block>) => onChange({ ...(block as any), ...patch } as Block);

  if (block.type === "heading") {
    return (
      <div className="space-y-3">
        <div><Label>Text</Label><Input value={block.text} onChange={(e) => set({ text: e.target.value } as any)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Úroveň</Label>
            <Select value={String(block.level)} onValueChange={(v) => set({ level: Number(v) as 1 | 2 | 3 } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">H1</SelectItem><SelectItem value="2">H2</SelectItem><SelectItem value="3">H3</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Zarovnání</Label>
            <Select value={block.align} onValueChange={(v) => set({ align: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="left">Vlevo</SelectItem><SelectItem value="center">Na střed</SelectItem><SelectItem value="right">Vpravo</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }
  if (block.type === "text") {
    return (
      <div className="space-y-3">
        <div><Label>Text</Label><Textarea rows={6} value={block.text} onChange={(e) => set({ text: e.target.value } as any)} /></div>
        <div><Label>Zarovnání</Label>
          <Select value={block.align} onValueChange={(v) => set({ align: v as any } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="left">Vlevo</SelectItem><SelectItem value="center">Na střed</SelectItem><SelectItem value="right">Vpravo</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="space-y-3">
        <div><Label>URL obrázku</Label><Input value={block.src} onChange={(e) => set({ src: e.target.value } as any)} /></div>
        <div><Label>Alt text</Label><Input value={block.alt} onChange={(e) => set({ alt: e.target.value } as any)} /></div>
        <div className="flex items-center justify-between"><Label>Zaoblené rohy</Label>
          <Switch checked={block.rounded} onCheckedChange={(v) => set({ rounded: v } as any)} />
        </div>
      </div>
    );
  }
  if (block.type === "button") {
    return (
      <div className="space-y-3">
        <div><Label>Popisek</Label><Input value={block.label} onChange={(e) => set({ label: e.target.value } as any)} /></div>
        <div><Label>Odkaz</Label><Input value={block.href} onChange={(e) => set({ href: e.target.value } as any)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Styl</Label>
            <Select value={block.variant} onValueChange={(v) => set({ variant: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="default">Plný</SelectItem><SelectItem value="outline">Obrys</SelectItem><SelectItem value="secondary">Sekundární</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Zarovnání</Label>
            <Select value={block.align} onValueChange={(v) => set({ align: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="left">Vlevo</SelectItem><SelectItem value="center">Na střed</SelectItem><SelectItem value="right">Vpravo</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }
  if (block.type === "spacer") {
    return <div><Label>Výška (px)</Label>
      <Input type="number" min={4} max={400} value={block.height}
        onChange={(e) => set({ height: Math.max(4, Math.min(400, Number(e.target.value) || 0)) } as any)} />
    </div>;
  }
  if (block.type === "divider") {
    return <div><Label>Styl</Label>
      <Select value={block.style} onValueChange={(v) => set({ style: v as any } as any)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="solid">Plná čára</SelectItem><SelectItem value="dashed">Přerušovaná</SelectItem><SelectItem value="glow">Neonová</SelectItem></SelectContent>
      </Select>
    </div>;
  }
  if (block.type === "quote") {
    return (
      <div className="space-y-3">
        <div><Label>Citace</Label><Textarea rows={4} value={block.text} onChange={(e) => set({ text: e.target.value } as any)} /></div>
        <div><Label>Autor (volitelné)</Label><Input value={block.author} onChange={(e) => set({ author: e.target.value } as any)} /></div>
      </div>
    );
  }
  if (block.type === "video") {
    return (
      <div className="space-y-3">
        <div><Label>URL videa</Label>
          <Input value={block.url} onChange={(e) => set({ url: e.target.value } as any)} placeholder="YouTube, Vimeo nebo .mp4" />
          <p className="text-xs text-muted-foreground mt-1">Podporováno: youtube.com, vimeo.com, přímý odkaz na .mp4/.webm</p>
        </div>
        <div><Label>Poměr stran</Label>
          <Select value={block.ratio} onValueChange={(v) => set({ ratio: v as any } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="4:3">4:3</SelectItem><SelectItem value="1:1">1:1</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (block.type === "html") {
    return (
      <div>
        <Label>HTML kód</Label>
        <Textarea rows={10} value={block.html} onChange={(e) => set({ html: e.target.value } as any)}
          className="font-mono text-xs" placeholder="<p>Vlastní HTML…</p>" />
        <p className="text-xs text-muted-foreground mt-1">HTML se sanitizuje (DOMPurify). Iframes z YouTube/Vimeo/Spotify jsou povoleny.</p>
      </div>
    );
  }
  if (block.type === "shortcode") {
    return (
      <div className="space-y-3">
        <div><Label>Shortcode</Label>
          <Input value={block.code} onChange={(e) => set({ code: e.target.value } as any)} className="font-mono text-xs" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Vložit připravený</Label>
          <div className="flex flex-col gap-1 mt-2">
            {SHORTCODES.map((s) => (
              <button key={s.code} onClick={() => set({ code: s.code } as any)}
                className="text-left text-xs p-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all">
                <div className="font-bold">{s.label}</div>
                <code className="text-muted-foreground">{s.code}</code>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (block.type === "accordion") {
    const updateItem = (id: string, patch: Partial<{ title: string; content: string }>) =>
      set({ items: block.items.map((it) => it.id === id ? { ...it, ...patch } : it) } as any);
    const addItem = () => set({ items: [...block.items, { id: crypto.randomUUID(), title: "Nová otázka", content: "" }] } as any);
    const removeItem = (id: string) => set({ items: block.items.filter((it) => it.id !== id) } as any);
    return (
      <div className="space-y-3">
        {block.items.map((it) => (
          <div key={it.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input value={it.title} onChange={(e) => updateItem(it.id, { title: e.target.value })} placeholder="Otázka" />
              <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Textarea rows={3} value={it.content} onChange={(e) => updateItem(it.id, { content: e.target.value })} placeholder="Odpověď" />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addItem} className="w-full"><Plus className="h-4 w-4 mr-1" /> Přidat položku</Button>
      </div>
    );
  }
  if (block.type === "cards") {
    const updateItem = (id: string, patch: Partial<{ icon: string; title: string; text: string }>) =>
      set({ items: block.items.map((it) => it.id === id ? { ...it, ...patch } : it) } as any);
    const addItem = () => set({ items: [...block.items, { id: crypto.randomUUID(), icon: "Sparkles", title: "Nová karta", text: "" }] } as any);
    const removeItem = (id: string) => set({ items: block.items.filter((it) => it.id !== id) } as any);
    return (
      <div className="space-y-3">
        <div><Label>Sloupců</Label>
          <Select value={String(block.columns)} onValueChange={(v) => set({ columns: Number(v) as 2 | 3 | 4 } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="4">4</SelectItem></SelectContent>
          </Select>
        </div>
        {block.items.map((it) => (
          <div key={it.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input value={it.icon} onChange={(e) => updateItem(it.id, { icon: e.target.value })} placeholder="Ikona (např. Zap, Shield, Users)" className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Input value={it.title} onChange={(e) => updateItem(it.id, { title: e.target.value })} placeholder="Nadpis" />
            <Textarea rows={2} value={it.text} onChange={(e) => updateItem(it.id, { text: e.target.value })} placeholder="Text" />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addItem} className="w-full"><Plus className="h-4 w-4 mr-1" /> Přidat kartu</Button>
        <p className="text-xs text-muted-foreground">Ikony: jakékoli z lucide-react (Zap, Shield, Users, Sparkles, Trophy…)</p>
      </div>
    );
  }
  if (block.type === "section") {
    return (
      <div className="space-y-3">
        <div><Label>Pozadí</Label>
          <Select value={block.background} onValueChange={(v) => set({ background: v as any } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Bez pozadí</SelectItem>
              <SelectItem value="muted">Tlumené</SelectItem>
              <SelectItem value="primary">Primární barva</SelectItem>
              <SelectItem value="accent">Akcentová</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Vnitřní mezera nahoře/dole (px)</Label>
          <Input type="number" min={0} max={200} value={block.paddingY}
            onChange={(e) => set({ paddingY: Math.max(0, Math.min(200, Number(e.target.value) || 0)) } as any)} />
        </div>
        <p className="text-xs text-muted-foreground">Bloky uvnitř sekce zatím přidávej jejich tažením do canvasu (basic verze).</p>
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">Sloupce upravuj přidáváním bloků dovnitř.</p>;
}
