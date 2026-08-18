import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Bell, Loader2, Volume2, Radio, ExternalLink, Link as LinkIcon, AtSign, UserCog, Package, AppWindow, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/PageHero";
import { AvatarUpload } from "@/components/AvatarUpload";
import { AccountSettings } from "@/components/AccountSettings";
import { AppearanceInventory } from "@/components/AppearanceInventory";
import { SocialHandleField } from "@/components/SocialHandleField";
import {
  ensureNotificationPermission,
  playNotifSound,
  getNotifSoundId,
  setNotifSoundId,
  NOTIF_SOUNDS,
  type NotifSoundId,
} from "@/lib/notify";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notifySound, setNotifySound] = useState(true);
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [twitch, setTwitch] = useState("");
  const [youtube, setYoutube] = useState("");
  const [kick, setKick] = useState("");
  const [soundId, setSoundId] = useState<NotifSoundId>(getNotifSoundId());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, bio, avatar_url, twitch_username, youtube_handle, kick_username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        setTwitch((data as any).twitch_username ?? "");
        setYoutube((data as any).youtube_handle ?? "");
        setKick((data as any).kick_username ?? "");
      }
      const { data: prefs } = await supabase.rpc("get_my_notification_prefs");
      const row = Array.isArray(prefs) ? prefs[0] : null;
      setNotifySound(row?.notify_sound ?? true);
      setNotifyBrowser(row?.notify_browser ?? true);
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({
        display_name: displayName,
        username,
        bio,
        notify_sound: notifySound,
        notify_browser: notifyBrowser,
        twitch_username: twitch.trim() || null,
        youtube_handle: youtube.trim() || null,
        kick_username: kick.trim() || null,
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: t("profile.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("profile.saved") });
  };

  const onBrowserToggle = async (v: boolean) => {
    setNotifyBrowser(v);
    if (v) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        toast({ title: t("profile.notifPermDenied"), variant: "destructive" });
        setNotifyBrowser(false);
      }
    }
  };

  const fallback = (displayName || username || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-6xl animate-fade-in">
        <PageHero
          eyebrow={t("profile.tagline") || "Účet"}
          title={t("profile.title")}
          description={t("profile.subtitle") || "Spravuj svůj profil, sociální sítě, oznámení a zvuky."}
          icon={UserCog}
        />
        <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
        <Card className="glass border-border p-8">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <form onSubmit={save} className="space-y-6">
              {user && (
                <AvatarUpload
                  userId={user.id}
                  avatarUrl={avatarUrl}
                  fallback={fallback}
                  onChange={setAvatarUrl}
                />
              )}
              <div className="space-y-2">
                <Label>{t("auth.email")}</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dn">{t("profile.displayName")}</Label>
                <Input
                  id="dn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("profile.displayNamePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("profile.displayNameHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="un">{t("profile.realName")}</Label>
                <Input
                  id="un"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("profile.realNamePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("profile.realNameHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{t("profile.bio")}</Label>
                <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")} />
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                  <Radio className="h-5 w-5 text-primary" /> {t("profile.streamingAccounts")}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("profile.streamingHint")}
                </p>
                <div className="space-y-4">
                  <SocialHandleField
                    id="tw"
                    label="Twitch"
                    color="#9146FF"
                    value={twitch}
                    onChange={setTwitch}
                    platform="twitch"
                    placeholder={t("profile.twitchPlaceholder")}
                  />
                  <SocialHandleField
                    id="yt"
                    label="YouTube"
                    color="#FF0033"
                    value={youtube}
                    onChange={setYoutube}
                    platform="youtube"
                    placeholder={t("profile.youtubePlaceholder")}
                  />
                  <SocialHandleField
                    id="ki"
                    label="Kick"
                    color="#53FC18"
                    value={kick}
                    onChange={setKick}
                    platform="kick"
                    placeholder={t("profile.kickPlaceholder")}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />{t("profile.notifications")}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Volume2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <Label htmlFor="ns" className="cursor-pointer">{t("profile.notifSound")}</Label>
                        <p className="text-xs text-muted-foreground">{t("profile.notifSoundDesc")}</p>
                      </div>
                    </div>
                    <Switch id="ns" checked={notifySound} onCheckedChange={setNotifySound} />
                  </div>
                  {notifySound && (
                    <div className="flex items-center justify-between gap-4 pl-7">
                      <Label htmlFor="sound-select" className="text-sm text-muted-foreground">
                        {t("profile.soundChoice")}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={soundId}
                          onValueChange={(v) => {
                            const id = v as NotifSoundId;
                            setSoundId(id);
                            setNotifSoundId(id);
                            playNotifSound(id);
                          }}
                        >
                          <SelectTrigger id="sound-select" className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NOTIF_SOUNDS.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {t(s.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => playNotifSound(soundId)}
                          aria-label={t("profile.playSound")}
                          title={t("profile.playSound")}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <Label htmlFor="nb" className="cursor-pointer">{t("profile.notifBrowser")}</Label>
                        <p className="text-xs text-muted-foreground">{t("profile.notifBrowserDesc")}</p>
                      </div>
                    </div>
                    <Switch id="nb" checked={notifyBrowser} onCheckedChange={onBrowserToggle} />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
              </Button>
            </form>
          )}
        </Card>

        {!loading && (
          <Card className="glass border-border p-8">
            <AppearanceInventory avatarUrl={avatarUrl} name={displayName || username || user?.email} />
          </Card>
        )}

        {!loading && (
          <Card className="glass border-border p-8">
            <AccountSettings />
          </Card>
        )}
        </div>

        <aside className="space-y-6">
          <Card className="glass border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <AppWindow className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold text-lg">Aplikace</h3>
            </div>

            <div className="pl-2 border-l-2 border-primary/30 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Formuláře</div>

              <Link to="/profile/formulare" className="block group">
                <div className="rounded-lg p-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 transition">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <div className="font-semibold text-sm">Moje formuláře</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Vytvořte formulář pro nábor, průzkum nebo zpětnou vazbu — sdílejte odkazem a sbírejte odpovědi.
                  </div>
                </div>
              </Link>

              <div className="text-xs uppercase tracking-wider text-muted-foreground pt-2">Zakázky</div>
              <Link to="/profile/zakazky" className="block group">
                <div className="rounded-lg p-3 bg-muted/30 hover:bg-muted/50 border border-border transition">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <div className="font-semibold text-sm">Moje zakázky</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Přehled vámi vytvořených zakázek na 3D tisk.
                  </div>
                </div>
              </Link>
            </div>
          </Card>
        </aside>
        </div>
      </main>
    </div>
  );
};

export default Profile;
