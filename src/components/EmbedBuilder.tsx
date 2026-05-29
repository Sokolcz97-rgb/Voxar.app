import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Send, Loader2, Plus, Trash2, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import { GuildResourceSelect } from "@/components/GuildResourceSelect";

type EmbedField = { name: string; value: string; inline: boolean };

type EmbedState = {
  title: string;
  description: string;
  url: string;
  color: string; // hex like #5865f2
  authorName: string;
  authorUrl: string;
  authorIcon: string;
  footerText: string;
  footerIcon: string;
  imageUrl: string;
  thumbnailUrl: string;
  timestamp: boolean;
  fields: EmbedField[];
};

const DEFAULT_EMBED: EmbedState = {
  title: "Test",
  description: "Z webu",
  url: "",
  color: "#58b9ff",
  authorName: "",
  authorUrl: "",
  authorIcon: "",
  footerText: "",
  footerIcon: "",
  imageUrl: "",
  thumbnailUrl: "",
  timestamp: false,
  fields: [],
};

const PRESET_COLORS = [
  "#5865f2", // blurple
  "#57f287", // green
  "#fee75c", // yellow
  "#eb459e", // pink
  "#ed4245", // red
  "#f0a040", // orange
  "#58b9ff", // sky
  "#9b59b6", // purple
];

function hexToInt(hex: string): number | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? parseInt(m[1], 16) : undefined;
}

function buildEmbed(state: EmbedState): Record<string, unknown> | null {
  const embed: Record<string, unknown> = {};
  if (state.title.trim()) embed.title = state.title;
  if (state.description.trim()) embed.description = state.description;
  if (state.url.trim()) embed.url = state.url;
  const color = hexToInt(state.color);
  if (color !== undefined) embed.color = color;
  if (state.authorName.trim()) {
    embed.author = {
      name: state.authorName,
      ...(state.authorUrl.trim() ? { url: state.authorUrl } : {}),
      ...(state.authorIcon.trim() ? { icon_url: state.authorIcon } : {}),
    };
  }
  if (state.footerText.trim() || state.footerIcon.trim()) {
    embed.footer = {
      text: state.footerText || "\u200b",
      ...(state.footerIcon.trim() ? { icon_url: state.footerIcon } : {}),
    };
  }
  if (state.imageUrl.trim()) embed.image = { url: state.imageUrl };
  if (state.thumbnailUrl.trim()) embed.thumbnail = { url: state.thumbnailUrl };
  if (state.timestamp) embed.timestamp = new Date().toISOString();
  const fields = state.fields.filter((f) => f.name.trim() || f.value.trim());
  if (fields.length) embed.fields = fields.map((f) => ({ name: f.name || "\u200b", value: f.value || "\u200b", inline: !!f.inline }));
  return Object.keys(embed).length ? embed : null;
}

export function EmbedBuilder({
  guildId,
  guildName,
  isManager,
  availableGuilds = [],
}: {
  guildId: string | null;
  guildName?: string | null;
  isManager: boolean;
  availableGuilds?: { guild_id: string; name: string }[];
}) {
  const [content, setContent] = useState("");
  const [embed, setEmbed] = useState<EmbedState>(DEFAULT_EMBED);
  const [pickedGuildId, setPickedGuildId] = useState<string>("");
  const effectiveGuildId = guildId ?? (pickedGuildId || null);
  const effectiveGuildName =
    guildName ?? availableGuilds.find((g) => g.guild_id === pickedGuildId)?.name ?? null;
  const [channelId, setChannelId] = useState<string>("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const builtEmbed = useMemo(() => buildEmbed(embed), [embed]);
  const previewJson = useMemo(
    () => JSON.stringify(builtEmbed ?? {}, null, 2),
    [builtEmbed],
  );

  const updateField = (idx: number, patch: Partial<EmbedField>) => {
    setEmbed((s) => ({
      ...s,
      fields: s.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };
  const addField = () =>
    setEmbed((s) => ({ ...s, fields: [...s.fields, { name: "", value: "", inline: false }] }));
  const removeField = (idx: number) =>
    setEmbed((s) => ({ ...s, fields: s.fields.filter((_, i) => i !== idx) }));

  const canSend = useMemo(() => {
    if (!isManager) return false;
    if (!content.trim() && !builtEmbed) return false;
    // either guild+channel OR webhook URL
    if (webhookUrl.trim()) return true;
    if (guildId && channelId) return true;
    return false;
  }, [isManager, content, builtEmbed, webhookUrl, guildId, channelId]);

  const send = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot-send", {
        body: {
          webhook_url: webhookUrl.trim() || undefined,
          channel_id: webhookUrl.trim() ? undefined : channelId || undefined,
          content: content || undefined,
          embed: builtEmbed ?? undefined,
          guild_id: guildId,
        },
      });
      if (error) throw error;
      toast({ title: data?.queued ? "Zařazeno do fronty bota" : "Odesláno" });
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? "Neznámá chyba", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const hasGuild = !!guildId;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="glass border-border p-6 space-y-5">
        {/* DESTINATION */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kam odeslat</Label>
          {hasGuild ? (
            <div className="space-y-2">
              <GuildResourceSelect
                guildId={guildId}
                kind="text"
                value={channelId}
                onChange={(v) => setChannelId(v ?? "")}
                placeholder="Vyber kanál na serveru"
              />
              <p className="text-xs text-muted-foreground">
                Bot odešle zprávu přímo do vybraného kanálu serveru <span className="text-foreground font-medium">{guildName ?? ""}</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={!isManager}
              />
              <p className="text-xs text-muted-foreground">
                Vlevo nahoře vyber konkrétní server, aby bylo možné poslat přes bota bez webhooku.
              </p>
            </div>
          )}
        </div>

        {/* MESSAGE */}
        <div className="space-y-2">
          <Label>Text zprávy <span className="text-muted-foreground text-xs">(volitelně)</span></Label>
          <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} disabled={!isManager} />
        </div>

        {/* EMBED BUILDER */}
        <div className="space-y-3 rounded-lg border border-border p-4 bg-background/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Embed</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={embed.color}
                onChange={(e) => setEmbed({ ...embed, color: e.target.value })}
                disabled={!isManager}
                className="h-8 w-10 rounded cursor-pointer bg-transparent border border-border"
                aria-label="Barva embedu"
              />
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEmbed({ ...embed, color: c })}
                    disabled={!isManager}
                    className="h-5 w-5 rounded-full border border-border/60 hover:scale-110 transition"
                    style={{ background: c }}
                    aria-label={`Barva ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Titulek</Label>
            <Input value={embed.title} onChange={(e) => setEmbed({ ...embed, title: e.target.value })} disabled={!isManager} />
          </div>

          <div>
            <Label className="text-xs">Popis</Label>
            <Textarea rows={4} value={embed.description} onChange={(e) => setEmbed({ ...embed, description: e.target.value })} disabled={!isManager} />
            <p className="text-[10px] text-muted-foreground mt-1">Podporuje markdown: **tučně**, *kurzíva*, `kód`, odkazy [text](url).</p>
          </div>

          <div>
            <Label className="text-xs">URL titulku <span className="text-muted-foreground">(volitelné)</span></Label>
            <Input placeholder="https://..." value={embed.url} onChange={(e) => setEmbed({ ...embed, url: e.target.value })} disabled={!isManager} />
          </div>

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="author">
              <AccordionTrigger className="text-sm">Autor</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Input placeholder="Jméno" value={embed.authorName} onChange={(e) => setEmbed({ ...embed, authorName: e.target.value })} disabled={!isManager} />
                <Input placeholder="URL (odkaz na jméno)" value={embed.authorUrl} onChange={(e) => setEmbed({ ...embed, authorUrl: e.target.value })} disabled={!isManager} />
                <Input placeholder="URL ikony autora" value={embed.authorIcon} onChange={(e) => setEmbed({ ...embed, authorIcon: e.target.value })} disabled={!isManager} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="media">
              <AccordionTrigger className="text-sm">Obrázky</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <div>
                  <Label className="text-xs">Velký obrázek (image)</Label>
                  <Input placeholder="https://..." value={embed.imageUrl} onChange={(e) => setEmbed({ ...embed, imageUrl: e.target.value })} disabled={!isManager} />
                </div>
                <div>
                  <Label className="text-xs">Náhled vpravo (thumbnail)</Label>
                  <Input placeholder="https://..." value={embed.thumbnailUrl} onChange={(e) => setEmbed({ ...embed, thumbnailUrl: e.target.value })} disabled={!isManager} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="footer">
              <AccordionTrigger className="text-sm">Patička</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Input placeholder="Text patičky" value={embed.footerText} onChange={(e) => setEmbed({ ...embed, footerText: e.target.value })} disabled={!isManager} />
                <Input placeholder="URL ikony patičky" value={embed.footerIcon} onChange={(e) => setEmbed({ ...embed, footerIcon: e.target.value })} disabled={!isManager} />
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-xs">Zobrazit aktuální čas</Label>
                  <Switch checked={embed.timestamp} onCheckedChange={(v) => setEmbed({ ...embed, timestamp: v })} disabled={!isManager} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="fields">
              <AccordionTrigger className="text-sm">
                Pole {embed.fields.length > 0 && <Badge variant="outline" className="ml-2">{embed.fields.length}</Badge>}
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {embed.fields.map((f, idx) => (
                  <div key={idx} className="rounded-md border border-border p-3 space-y-2 bg-background/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pole #{idx + 1}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeField(idx)} disabled={!isManager}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input placeholder="Název" value={f.name} onChange={(e) => updateField(idx, { name: e.target.value })} disabled={!isManager} />
                    <Textarea rows={2} placeholder="Hodnota" value={f.value} onChange={(e) => updateField(idx, { value: e.target.value })} disabled={!isManager} />
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Inline (vedle sebe)</Label>
                      <Switch checked={f.inline} onCheckedChange={(v) => updateField(idx, { inline: v })} disabled={!isManager} />
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addField} disabled={!isManager}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Přidat pole
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="advanced">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2"><Code2 className="h-3.5 w-3.5" /> Pokročilé</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {hasGuild && (
                  <div className="space-y-1">
                    <Label className="text-xs">Webhook URL (přepíše bota)</Label>
                    <Input
                      placeholder="https://discord.com/api/webhooks/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      disabled={!isManager}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Pokud vyplníš, zpráva půjde přes webhook a kanál výše se ignoruje.
                    </p>
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAdvanced ? "Skrýt JSON náhled" : "Zobrazit JSON náhled"}
                  </button>
                  {showAdvanced && (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-background/50 p-3 text-[11px] font-mono">
{previewJson}
                    </pre>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Button onClick={send} disabled={!canSend || sending} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Odeslat {guildName && `do ${guildName}`}
        </Button>
        {!canSend && isManager && (
          <p className="text-[11px] text-muted-foreground text-center">
            {hasGuild ? "Vyber kanál a vyplň zprávu nebo embed." : "Vyplň webhook URL a zprávu nebo embed."}
          </p>
        )}
      </Card>

      <div className="space-y-2 lg:sticky lg:top-24 self-start">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Živý náhled</Label>
        <Card className="glass border-border p-4">
          <DiscordMessagePreview content={content} embed={builtEmbed ?? undefined} />
        </Card>
      </div>
    </div>
  );
}
