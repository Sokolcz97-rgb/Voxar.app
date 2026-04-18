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
import { Bell, Loader2, Volume2 } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { AccountSettings } from "@/components/AccountSettings";
import { ensureNotificationPermission, playBeep } from "@/lib/notify";

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

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setUsername(data.username ?? "");
          setBio(data.bio ?? "");
          setAvatarUrl(data.avatar_url ?? null);
          setNotifySound(data.notify_sound ?? true);
          setNotifyBrowser(data.notify_browser ?? true);
        }
        setLoading(false);
      });
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
      })
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
      <main className="container py-10 max-w-2xl animate-fade-in">
        <h1 className="font-display font-black text-4xl mb-8 text-glow">{t("profile.title")}</h1>
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
                <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="un">{t("profile.username")}</Label>
                <Input id="un" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{t("profile.bio")}</Label>
                <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")} />
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
                    <div className="flex items-center gap-2">
                      {notifySound && (
                        <Button type="button" variant="ghost" size="sm" onClick={playBeep}>
                          {t("profile.test")}
                        </Button>
                      )}
                      <Switch id="ns" checked={notifySound} onCheckedChange={setNotifySound} />
                    </div>
                  </div>
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
          <Card className="glass border-border p-8 mt-6">
            <AccountSettings />
          </Card>
        )}
      </main>
    </div>
  );
};

export default Profile;
