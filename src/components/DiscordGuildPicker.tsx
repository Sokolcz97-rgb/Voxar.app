import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface DiscordGuildOption {
  id: string;
  name: string;
  icon_url: string | null;
  owner: boolean;
  approximate_member_count: number | null;
}

interface ExistingGuild {
  guild_id: string;
  owner_user_id: string | null;
  owner_discord_id: string | null;
  status: string;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a guild is successfully claimed/added — parent should reload its lists. */
  onClaimed?: (guildId: string) => void;
};

/**
 * Reusable popup that performs Discord OAuth, lists the user's manageable
 * Discord servers and lets them claim/add them as bot guilds via the
 * `bot-guild-claim` edge function. Verified Discord owners/admins get
 * automatic approval — no admin review needed.
 */
export function DiscordGuildPicker({ open, onOpenChange, onClaimed }: Props) {
  const { user } = useAuth();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [guilds, setGuilds] = useState<DiscordGuildOption[]>([]);
  const [existing, setExisting] = useState<ExistingGuild[]>([]);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordUserId, setDiscordUserId] = useState<string | null>(null);
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  const loadExisting = async () => {
    const { data } = await supabase
      .from("bot_guilds")
      .select("guild_id, owner_user_id, owner_discord_id, status");
    setExisting((data as ExistingGuild[]) ?? []);
  };

  useEffect(() => {
    if (open) void loadExisting();
  }, [open]);

  const loadPickerForNonce = async (nonce: string) => {
    const { data, error } = await supabase.functions.invoke("discord-oauth-result", {
      body: { state: nonce },
    });
    if (error || !data) {
      toast.error("Nepodařilo se načíst seznam serverů z Discordu.");
      return;
    }
    setGuilds((data as any).guilds || []);
    setDiscordUsername((data as any).discord_username || null);
    setDiscordUserId((data as any).discord_user_id || null);
    setOauthState(nonce);
    await loadExisting();
  };

  // Listen for OAuth completion (popup -> postMessage / BroadcastChannel / localStorage)
  useEffect(() => {
    const handleNonce = (nonce: string) => {
      setOauthLoading(false);
      void loadPickerForNonce(nonce);
    };
    const handler = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data as any;
      if (d?.type === "discord-oauth-result" && d.nonce) handleNonce(d.nonce);
    };
    const storage = (ev: StorageEvent) => {
      if (ev.key !== "discord-oauth-result" || !ev.newValue) return;
      try {
        const d = JSON.parse(ev.newValue);
        if (d?.type === "discord-oauth-result" && d.nonce) handleNonce(d.nonce);
      } catch {}
    };
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("discord-oauth");
      ch.onmessage = (ev) => {
        const d = ev.data as any;
        if (d?.type === "discord-oauth-result" && d.nonce) handleNonce(d.nonce);
      };
    } catch {}
    window.addEventListener("message", handler);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("message", handler);
      window.removeEventListener("storage", storage);
      ch?.close();
    };
  }, []);

  const startDiscordOAuth = async () => {
    setOauthLoading(true);
    const w = 500, h = 800;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      "about:blank",
      "discord-oauth",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    try {
      const { data, error } = await supabase.functions.invoke("discord-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error || !(data as any)?.url) {
        popup?.close();
        setOauthLoading(false);
        toast.error("Nepodařilo se spustit přihlášení přes Discord.");
        return;
      }
      if (popup && !popup.closed) {
        popup.location.href = (data as any).url;
        const t = setInterval(() => {
          if (popup.closed) { clearInterval(t); setOauthLoading(false); }
        }, 500);
      } else {
        setOauthLoading(false);
        const opened = window.open((data as any).url, "_blank", "noopener=no");
        if (!opened) toast.error("Povol vyskakovací okna pro tento web a zkus to znovu.");
      }
    } catch {
      popup?.close();
      setOauthLoading(false);
      toast.error("Nepodařilo se spustit přihlášení přes Discord.");
    }
  };

  const claimGuild = async (g: DiscordGuildOption) => {
    if (!oauthState) {
      toast.error("Chybí ověřená Discord session — přihlas se znovu.");
      return;
    }
    setSubmittingIds((s) => new Set(s).add(g.id));
    try {
      const { data, error } = await supabase.functions.invoke("bot-guild-claim", {
        body: { state: oauthState, guild_id: g.id },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Nepodařilo se převzít server");
        return;
      }
      toast.success(`${g.name}: schváleno a přidáno k tvým serverům`);
      await loadExisting();
      onClaimed?.(g.id);
    } finally {
      setSubmittingIds((s) => { const n = new Set(s); n.delete(g.id); return n; });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Přidat / převzít můj server
            {discordUsername ? ` · ${discordUsername}` : ""}
          </DialogTitle>
          <DialogDescription>
            Přihlas se přes Discord — uvidíš servery, kde jsi vlastník nebo admin.
            Vyber server, kterého chceš vlastnit. Schválí se automaticky.
          </DialogDescription>
        </DialogHeader>

        {guilds.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <Button onClick={startDiscordOAuth} disabled={oauthLoading}>
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Přihlásit se přes Discord
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Otevře se vyskakovací okno Discordu. Pokud ti ho prohlížeč blokuje, povol popup pro tento web.
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto -mx-6 px-6 space-y-2">
            <div className="flex items-center justify-between gap-2 sticky top-0 bg-background/90 backdrop-blur py-2 z-10">
              <p className="text-xs text-muted-foreground">
                {guilds.length} serverů · vyber, který chceš vlastnit
              </p>
              <Button size="sm" variant="ghost" onClick={startDiscordOAuth} disabled={oauthLoading}>
                {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Přepnout účet"}
              </Button>
            </div>
            {guilds.map((g) => {
              const ex = existing.find((x) => x.guild_id === g.id);
              const mine =
                ex &&
                ((!!user && ex.owner_user_id === user.id) ||
                  (!!discordUserId && ex.owner_discord_id === discordUserId));
              const submitting = submittingIds.has(g.id);
              return (
                <div key={g.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {g.icon_url ? (
                    <img src={g.icon_url} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.owner ? "Vlastník" : "Administrátor"}
                      {g.approximate_member_count != null && ` · ${g.approximate_member_count} členů`}
                    </div>
                  </div>
                  {mine ? (
                    <Badge variant="default">Tvůj · {ex!.status}</Badge>
                  ) : (
                    <Button size="sm" onClick={() => claimGuild(g)} disabled={submitting}>
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : ex ? (
                        "Převzít vlastnictví"
                      ) : (
                        "Přidat & schválit"
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
