import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Block } from "@/lib/pageBuilder/types";

export function BlockSettings({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const set = <K extends keyof Block>(patch: Partial<Block>) =>
    onChange({ ...(block as any), ...patch } as Block);

  if (block.type === "heading") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Text</Label>
          <Input value={block.text} onChange={(e) => set({ text: e.target.value } as any)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Úroveň</Label>
            <Select value={String(block.level)} onValueChange={(v) => set({ level: Number(v) as 1 | 2 | 3 } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1</SelectItem>
                <SelectItem value="2">H2</SelectItem>
                <SelectItem value="3">H3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zarovnání</Label>
            <Select value={block.align} onValueChange={(v) => set({ align: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Vlevo</SelectItem>
                <SelectItem value="center">Na střed</SelectItem>
                <SelectItem value="right">Vpravo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }
  if (block.type === "text") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Text</Label>
          <Textarea rows={6} value={block.text} onChange={(e) => set({ text: e.target.value } as any)} />
        </div>
        <div>
          <Label>Zarovnání</Label>
          <Select value={block.align} onValueChange={(v) => set({ align: v as any } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Vlevo</SelectItem>
              <SelectItem value="center">Na střed</SelectItem>
              <SelectItem value="right">Vpravo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="space-y-3">
        <div>
          <Label>URL obrázku</Label>
          <Input value={block.src} onChange={(e) => set({ src: e.target.value } as any)} />
        </div>
        <div>
          <Label>Alt text</Label>
          <Input value={block.alt} onChange={(e) => set({ alt: e.target.value } as any)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Zaoblené rohy</Label>
          <Switch checked={block.rounded} onCheckedChange={(v) => set({ rounded: v } as any)} />
        </div>
      </div>
    );
  }
  if (block.type === "button") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Popisek</Label>
          <Input value={block.label} onChange={(e) => set({ label: e.target.value } as any)} />
        </div>
        <div>
          <Label>Odkaz (URL nebo /cesta)</Label>
          <Input value={block.href} onChange={(e) => set({ href: e.target.value } as any)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Styl</Label>
            <Select value={block.variant} onValueChange={(v) => set({ variant: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Plný</SelectItem>
                <SelectItem value="outline">Obrys</SelectItem>
                <SelectItem value="secondary">Sekundární</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zarovnání</Label>
            <Select value={block.align} onValueChange={(v) => set({ align: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Vlevo</SelectItem>
                <SelectItem value="center">Na střed</SelectItem>
                <SelectItem value="right">Vpravo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }
  if (block.type === "spacer") {
    return (
      <div>
        <Label>Výška (px)</Label>
        <Input
          type="number"
          min={4}
          max={400}
          value={block.height}
          onChange={(e) => set({ height: Math.max(4, Math.min(400, Number(e.target.value) || 0)) } as any)}
        />
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">Sloupce upravuj přidáváním bloků dovnitř.</p>;
}
