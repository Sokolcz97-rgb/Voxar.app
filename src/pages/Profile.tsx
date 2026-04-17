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
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setUsername(data.username ?? "");
          setBio(data.bio ?? "");
        }
        setLoading(false);
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ display_name: displayName, username, bio })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: t("profile.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("profile.saved") });
  };

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
            <form onSubmit={save} className="space-y-5">
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
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Profile;
