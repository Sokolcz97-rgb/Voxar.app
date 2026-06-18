import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Twitch, Youtube, Shield, MessageSquare, Bot } from "lucide-react";
import { toast } from "sonner";

type Platform = "twitch" | "youtube";

type Channel = {
  id: string;
  platform: Platform;
  handle: string;
  display_name: string | null;
  enabled: boolean;
  automod_enabled: boolean;
  antiscam_enabled: boolean;
  welcome_enabled: boolean;
  welcome_message: string | null;
  last_connected_at: string | null;
  last_status: string | null;
};

type Automod = {
  channel_id: string;
  blocked_words: string[];
  max_caps_pct: number;
  caps_min_length: number;
  max_links: number;
  allow_links_for_subs: boolean;
  allow_links_for_mods: boolean;
  link_whitelist: string[];
  max_emojis: number;
  spam_threshold: number;
  spam_window_seconds: number;
  action: "warn" | "delete" | "timeout" | "ban";
  timeout_seconds: number;
};

type Command = {
  id: string;
  channel_id: string;
  trigger: string;
  response: string;
  cooldown_seconds: number;
  mods_only: boolean;
  enabled: boolean;
};

const AdminChatBot = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState<Platform>("twitch");
  const [newHandle, setNewHandle] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_bot_channels")
      .select("*")
      .order("platform")
      .order("handle");
    if (error) toast.error(error.message);
    setChannels((data ?? []) as Channel[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addChannel = async () => {
    const h = newHandle.trim().replace(/^@/, "").toLowerCase();
    if (!h) return toast.error("Zadej handle kanálu");
    const { error } = await supabase
      .from("chat_bot_channels")
      .insert({ platform: newPlatform, handle: h, display_name: newHandle.trim() });
    if (error) return toast.error(error.message);
    toast.success("Kanál přidán");
    setAddOpen(false);
    setNewHandle("");
    load();
  };

  const twitch = channels.filter((c) => c.platform === "twitch");
  const youtube = channels.filter((c) => c.platform === "youtube");

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-8 md:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow flex items-center gap-2">
              <Bot className="h-4 w-4" /> Chat bot
            </p>
            <h1 className="font-display font-black text-3xl md:text-5xl mt-2">
              Twitch & YouTube chat
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Spravuj chat bota stejně jako na Discordu — automod, anti-scam, uvítání a vlastní příkazy.
              Bot píše pod jedním sdíleným účtem.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Přidat kanál
          </Button>
        </div>

        <Tabs defaultValue="twitch" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="twitch" className="gap-2">
              <Twitch className="h-4 w-4" /> Twitch
              <Badge variant="secondary" className="ml-1">{twitch.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-2">
              <Youtube className="h-4 w-4" /> YouTube
              <Badge variant="secondary" className="ml-1">{youtube.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="twitch" className="space-y-4">
            {loading ? <p className="text-muted-foreground">Načítám…</p> : null}
            {!loading && twitch.length === 0 ? (
              <EmptyState platform="twitch" onAdd={() => { setNewPlatform("twitch"); setAddOpen(true); }} />
            ) : null}
            {twitch.map((c) => (
              <ChannelCard key={c.id} channel={c} onChange={load} />
            ))}
          </TabsContent>

          <TabsContent value="youtube" className="space-y-4">
            {loading ? <p className="text-muted-foreground">Načítám…</p> : null}
            {!loading && youtube.length === 0 ? (
              <EmptyState platform="youtube" onAdd={() => { setNewPlatform("youtube"); setAddOpen(true); }} />
            ) : null}
            {youtube.map((c) => (
              <ChannelCard key={c.id} channel={c} onChange={load} />
            ))}
          </TabsContent>
        </Tabs>

        <Card className="glass border-border p-5 mt-10 text-sm text-muted-foreground">
          <p className="font-display font-bold text-foreground mb-2">Jak to funguje</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Bot se připojí do chatu pod sdíleným bot účtem (nastavený v secrets bota).</li>
            <li>Automod a anti-scam reagují v reálném čase – maže zprávy, timeout nebo ban.</li>
            <li>Vlastní příkazy můžeš psát s placeholderem <code>{"{user}"}</code> a <code>{"{game}"}</code>.</li>
            <li>YouTube Live Chat má denní API kvótu 10 000 jednotek – při dlouhém streamu se polling zpomalí.</li>
          </ul>
        </Card>
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat kanál</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Platforma</Label>
              <Select value={newPlatform} onValueChange={(v: Platform) => setNewPlatform(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitch">Twitch</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Handle / uživatelské jméno</Label>
              <Input
                className="mt-1"
                placeholder={newPlatform === "twitch" ? "např. sokolcze1997" : "např. @sokolcze nebo UC..."}
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Zrušit</Button>
            <Button onClick={addChannel}>Přidat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function EmptyState({ platform, onAdd }: { platform: Platform; onAdd: () => void }) {
  return (
    <Card className="glass border-border p-8 text-center">
      {platform === "twitch" ? <Twitch className="h-10 w-10 mx-auto text-primary mb-3" /> : <Youtube className="h-10 w-10 mx-auto text-primary mb-3" />}
      <p className="font-display font-bold text-lg">Žádný kanál</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Přidej {platform === "twitch" ? "Twitch" : "YouTube"} kanál, do kterého má bot vstoupit.
      </p>
      <Button onClick={onAdd} className="gap-2"><Plus className="h-4 w-4" /> Přidat</Button>
    </Card>
  );
}

function ChannelCard({ channel, onChange }: { channel: Channel; onChange: () => void }) {
  const [c, setC] = useState(channel);
  const [automod, setAutomod] = useState<Automod | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [savingC, setSavingC] = useState(false);

  useEffect(() => { setC(channel); }, [channel]);

  const loadDetails = async () => {
    const [a, cmd] = await Promise.all([
      supabase.from("chat_bot_automod").select("*").eq("channel_id", channel.id).maybeSingle(),
      supabase.from("chat_bot_commands").select("*").eq("channel_id", channel.id).order("trigger"),
    ]);
    if (a.data) setAutomod(a.data as Automod);
    setCommands((cmd.data ?? []) as Command[]);
  };

  const saveChannel = async (patch: Partial<Channel>) => {
    const next = { ...c, ...patch };
    setC(next);
    const { error } = await supabase
      .from("chat_bot_channels")
      .update(patch)
      .eq("id", channel.id);
    if (error) toast.error(error.message);
  };

  const remove = async () => {
    if (!confirm(`Smazat kanál ${channel.handle}?`)) return;
    const { error } = await supabase.from("chat_bot_channels").delete().eq("id", channel.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    onChange();
  };

  const saveAutomod = async () => {
    if (!automod) return;
    setSavingC(true);
    const { error } = await supabase
      .from("chat_bot_automod")
      .update(automod)
      .eq("channel_id", channel.id);
    setSavingC(false);
    if (error) return toast.error(error.message);
    toast.success("Automod uložen");
  };

  const addCommand = async () => {
    const trig = prompt("Příkaz (např. !discord):")?.trim();
    if (!trig) return;
    const resp = prompt("Odpověď:")?.trim();
    if (!resp) return;
    const { error } = await supabase
      .from("chat_bot_commands")
      .insert({ channel_id: channel.id, trigger: trig.toLowerCase(), response: resp });
    if (error) return toast.error(error.message);
    loadDetails();
  };

  const removeCommand = async (id: string) => {
    const { error } = await supabase.from("chat_bot_commands").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadDetails();
  };

  const Icon = channel.platform === "twitch" ? Twitch : Youtube;

  return (
    <Card className="glass border-border overflow-hidden">
      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-display font-bold text-lg flex items-center gap-2">
              {c.display_name || c.handle}
              <Badge variant={c.enabled ? "default" : "secondary"}>
                {c.enabled ? "Aktivní" : "Vypnuto"}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              {c.platform} · {c.handle}
              {c.last_connected_at ? ` · připojeno ${new Date(c.last_connected_at).toLocaleString("cs-CZ")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={c.enabled} onCheckedChange={(v) => saveChannel({ enabled: v })} />
            <Label className="text-xs">Zapnuto</Label>
          </div>
          <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <Accordion type="single" collapsible onValueChange={(v) => v && loadDetails()}>
        <AccordionItem value="automod" className="border-b border-border/60">
          <AccordionTrigger className="px-5 hover:no-underline">
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Automod & anti-scam</span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Toggle label="Automod (slova, caps, spam, linky)" value={c.automod_enabled}
                onChange={(v) => saveChannel({ automod_enabled: v })} />
              <Toggle label="Anti-scam / phishing (instant ban)" value={c.antiscam_enabled}
                onChange={(v) => saveChannel({ antiscam_enabled: v })} />
            </div>

            {automod ? (
              <div className="space-y-3 pt-3 border-t border-border/40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <NumField label="Max % CAPS" value={automod.max_caps_pct}
                    onChange={(v) => setAutomod({ ...automod, max_caps_pct: v })} />
                  <NumField label="Min. délka zprávy pro caps check" value={automod.caps_min_length}
                    onChange={(v) => setAutomod({ ...automod, caps_min_length: v })} />
                  <NumField label="Max odkazů (0 = zákaz)" value={automod.max_links}
                    onChange={(v) => setAutomod({ ...automod, max_links: v })} />
                  <NumField label="Max emoji" value={automod.max_emojis}
                    onChange={(v) => setAutomod({ ...automod, max_emojis: v })} />
                  <NumField label="Spam: zpráv za okno" value={automod.spam_threshold}
                    onChange={(v) => setAutomod({ ...automod, spam_threshold: v })} />
                  <NumField label="Spam: okno (s)" value={automod.spam_window_seconds}
                    onChange={(v) => setAutomod({ ...automod, spam_window_seconds: v })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Toggle label="Povolit odkazy subscriberům" value={automod.allow_links_for_subs}
                    onChange={(v) => setAutomod({ ...automod, allow_links_for_subs: v })} />
                  <Toggle label="Povolit odkazy moderátorům" value={automod.allow_links_for_mods}
                    onChange={(v) => setAutomod({ ...automod, allow_links_for_mods: v })} />
                </div>

                <div>
                  <Label className="text-xs">Whitelist domén (čárkami)</Label>
                  <Input
                    className="mt-1"
                    value={automod.link_whitelist.join(", ")}
                    onChange={(e) => setAutomod({
                      ...automod,
                      link_whitelist: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Blokovaná slova navíc (čárkami)</Label>
                  <Textarea
                    className="mt-1 min-h-[60px]"
                    placeholder="slovo1, slovo2, slovo3"
                    value={automod.blocked_words.join(", ")}
                    onChange={(e) => setAutomod({
                      ...automod,
                      blocked_words: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Výchozí slovník (sprostá slova) je vždy aktivní.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Akce při porušení</Label>
                    <Select value={automod.action} onValueChange={(v: Automod["action"]) => setAutomod({ ...automod, action: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warn">Pouze varování</SelectItem>
                        <SelectItem value="delete">Smazat zprávu</SelectItem>
                        <SelectItem value="timeout">Timeout</SelectItem>
                        <SelectItem value="ban">Ban</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {automod.action === "timeout" ? (
                    <NumField label="Timeout (sekundy)" value={automod.timeout_seconds}
                      onChange={(v) => setAutomod({ ...automod, timeout_seconds: v })} />
                  ) : null}
                </div>

                <Button onClick={saveAutomod} disabled={savingC}>Uložit automod</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Načítám…</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="welcome" className="border-b border-border/60">
          <AccordionTrigger className="px-5 hover:no-underline">
            <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Uvítací zpráva</span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 space-y-3">
            <Toggle label="Posílat uvítání novým divákům / subscriberům"
              value={c.welcome_enabled}
              onChange={(v) => saveChannel({ welcome_enabled: v })} />
            <div>
              <Label className="text-xs">Šablona zprávy</Label>
              <Textarea
                className="mt-1"
                value={c.welcome_message ?? ""}
                onChange={(e) => setC({ ...c, welcome_message: e.target.value })}
                onBlur={() => saveChannel({ welcome_message: c.welcome_message })}
                placeholder="Vítej v chatu {user}! 👋"
              />
              <p className="text-xs text-muted-foreground mt-1">Placeholders: <code>{"{user}"}</code>, <code>{"{game}"}</code></p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="commands">
          <AccordionTrigger className="px-5 hover:no-underline">
            <span className="flex items-center gap-2"><Bot className="h-4 w-4" /> Vlastní příkazy ({commands.length})</span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 space-y-3">
            <Button size="sm" variant="outline" onClick={addCommand} className="gap-2">
              <Plus className="h-4 w-4" /> Přidat příkaz
            </Button>
            {commands.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žádné vlastní příkazy.</p>
            ) : (
              <div className="space-y-2">
                {commands.map((cmd) => (
                  <div key={cmd.id} className="flex items-center justify-between gap-3 p-3 rounded border border-border/60 bg-background/50">
                    <div className="min-w-0">
                      <p className="font-mono text-sm">{cmd.trigger}</p>
                      <p className="text-xs text-muted-foreground truncate">{cmd.response}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeCommand(cmd.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded border border-border/60 bg-background/40">
      <Label className="text-sm">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="mt-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

export default AdminChatBot;
