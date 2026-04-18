import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Shield, Users, Settings, BarChart3, MessageSquareWarning, Palette, Gamepad2, MessageCircle } from "lucide-react";

const Admin = () => {
  const sections = [
    { icon: Users, title: "Uživatelé & Role", desc: "Spravovat účty a oprávnění", to: "/admin/users" },
    { icon: Shield, title: "Role & Oprávnění", desc: "Vytvořit role a nastavit, co smí", to: "/admin/roles" },
    { icon: Shield, title: "Moderace", desc: "Log filtrovaného a zablokovaného obsahu", to: "/admin/moderation" },
    { icon: Palette, title: "Page Builder", desc: "Drag & drop editor stránek", to: "/admin/pages" },
    { icon: Gamepad2, title: "Hry", desc: "Katalog her pro server list", to: "/admin/games" },
    { icon: MessageCircle, title: "Discord servery", desc: "Spravovat invite odkazy a featured tlačítko", to: "/admin/discord" },
    { icon: BarChart3, title: "Statistiky", desc: "Návštěvnost a aktivita", to: null },
    { icon: MessageSquareWarning, title: "Tickety", desc: "Helpdesk", to: "/tickets" },
    { icon: Settings, title: "Nastavení webu", desc: "Téma, jazyky, média", to: null },
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
          {sections.map((s) => {
            const card = (
              <Card className="glass border-border p-6 hover:border-primary/60 transition-all hover:translate-y-[-4px] cursor-pointer group h-full">
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </Card>
            );
            return s.to ? (
              <Link key={s.title} to={s.to}>{card}</Link>
            ) : (
              <div key={s.title} className="opacity-60">{card}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Admin;
