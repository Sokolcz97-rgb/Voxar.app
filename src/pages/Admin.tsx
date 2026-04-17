import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Shield, Users, Settings, BarChart3, MessageSquareWarning, Palette } from "lucide-react";

const Admin = () => {
  const sections = [
    { icon: Users, title: "Uživatelé & Role", desc: "Spravovat účty a oprávnění" },
    { icon: Shield, title: "Moderace", desc: "Filtr zpráv, banování" },
    { icon: BarChart3, title: "Statistiky", desc: "Návštěvnost a aktivita" },
    { icon: Palette, title: "Page Builder", desc: "Drag & drop editor (brzy)" },
    { icon: MessageSquareWarning, title: "Tickety", desc: "Helpdesk (brzy)" },
    { icon: Settings, title: "Nastavení webu", desc: "Téma, jazyky, média" },
  ];

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
          <h1 className="font-display font-black text-4xl md:text-5xl mt-2">Control Panel</h1>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sections.map((s) => (
            <Card key={s.title} className="glass border-border p-6 hover:border-primary/60 transition-all hover:translate-y-[-4px] cursor-pointer group">
              <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Admin;
