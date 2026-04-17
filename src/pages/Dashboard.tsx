import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, Users, MessageSquare, Activity } from "lucide-react";

const Dashboard = () => {
  const { user, roles } = useAuth();
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, username").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-10 animate-fade-in">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Vítej zpět</p>
          <h1 className="font-display font-black text-4xl md:text-5xl mt-2">
            {profile?.display_name || profile?.username || "Hráči"}
          </h1>
          <p className="text-muted-foreground mt-2">
            Role: {roles.length ? roles.join(", ") : "user"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Trophy, label: "Tvé skóre", value: "0" },
            { icon: Users, label: "Přátelé", value: "0" },
            { icon: MessageSquare, label: "Zprávy", value: "0" },
            { icon: Activity, label: "Streak", value: "1d" },
          ].map((s) => (
            <Card key={s.label} className="glass border-border p-5 hover:border-primary/50 transition-all">
              <s.icon className="h-5 w-5 text-primary mb-3" />
              <div className="font-display text-3xl font-bold">{s.value}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
            </Card>
          ))}
        </div>

        <Card className="glass border-border p-8 text-center">
          <h2 className="font-display text-2xl font-bold mb-2">🚀 Hub se právě rozjíždí</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Brzy přibyde fórum, soukromé zprávy, ticketovací systém a AI helper.
            Sleduj novinky!
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
