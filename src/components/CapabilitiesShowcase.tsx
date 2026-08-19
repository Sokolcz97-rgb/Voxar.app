import {
  Globe,
  Users,
  MessageSquare,
  Trophy,
  Radio,
  Newspaper,
  Ticket,
  ShoppingBag,
  Search,
  Palette,
  Bell,
  Shield,
  Bot,
  Hash,
  Mic,
  Sparkles,
  Languages,
  Gauge,
  UserCheck,
  Zap,
  Coins,
  ServerCog,
} from "lucide-react";

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

const webFeatures: Feature[] = [
  { icon: Users, title: "Účty & profily", desc: "Registrace, veřejné profily, avatary, sociální odkazy, role a hodnosti." },
  { icon: MessageSquare, title: "Fórum & diskuze", desc: "Kategorie, vlákna, reakce, přílohy, bohatý editor a citace." },
  { icon: Hash, title: "Přímé zprávy", desc: "Soukromé konverzace 1:1 s notifikacemi a překladem." },
  { icon: Trophy, title: "Žebříčky & body", desc: "Top hráči, aktivita, statistiky a měsíční pořadí." },
  { icon: Radio, title: "Live streamy", desc: "Automatický přehled živých vysílání z Twitche a YouTube." },
  { icon: Newspaper, title: "Novinky & herní releasy", desc: "Aktuální novinky, releasy her a nadcházející tituly." },
  { icon: Ticket, title: "Ticket systém", desc: "Podpora, žádosti a hlášení propojené s Discordem." },
  { icon: ShoppingBag, title: "Objednávky služeb", desc: "Vytváření zakázek, správa modelů a přehled objednávek." },
  { icon: Palette, title: "Page Builder", desc: "Editace obsahu přímo na stránce, bloky a shortcodes." },
  { icon: Bell, title: "Oznámení", desc: "Notifikace v reálném čase a oznamovací lišta na úvodu." },
  { icon: Search, title: "Globální vyhledávání", desc: "Rychlé fulltext hledání napříč webem s historií." },
  { icon: Shield, title: "Moderace obsahu", desc: "AI moderace textu i obrázků a ochrana před spamem." },
  { icon: Sparkles, title: "AI asistent", desc: "Chytrý pomocník pro dotazy, návody a nápovědu." },
  { icon: Languages, title: "Vícejazyčnost", desc: "Čeština a angličtina s automatickým překladem zpráv." },
];

const botFeatures: Feature[] = [
  { icon: ServerCog, title: "Správa serverů", desc: "Přidání bota na Discord server a nastavení funkcí z webu." },
  { icon: Shield, title: "AutoMod & Anti-scam", desc: "Blokování zakázaných slov, odkazů a phishingu v reálném čase." },
  { icon: Ticket, title: "Discord tickety", desc: "Vytváření a synchronizace ticketů mezi webem a Discordem." },
  { icon: UserCheck, title: "Uvítací zprávy", desc: "Vlastní welcome zprávy pro nové členy s embedy." },
  { icon: Mic, title: "Voice body", desc: "Odměňování aktivity ve voice kanálech body a hodnostmi." },
  { icon: Coins, title: "Ekonomika & odměny", desc: "Bodový systém propojený s webovým žebříčkem." },
  { icon: Radio, title: "Stream oznámení", desc: "Automatické notifikace o živých streamech na Discordu." },
  { icon: Gauge, title: "Statistiky serveru", desc: "Živé počty členů, online a další metriky v kanálech." },
  { icon: Languages, title: "Překlad zpráv", desc: "Reakce-based překlad libovolné zprávy do CS/EN." },
  { icon: Zap, title: "Slash příkazy", desc: "Bohatá sada / příkazů pro moderaci i zábavu." },
  { icon: Bell, title: "Cross-post na web", desc: "Zprávy z Discordu propojené s fórem a novinkami." },
  { icon: Bot, title: "24/7 provoz", desc: "Stabilní běh s heartbeatem a auto-restartem." },
];

function FeatureCard({ f, i }: { f: Feature; i: number }) {
  return (
    <div
      className="group web-panel web-cut p-5 transition-all duration-300 hover:translate-y-[-4px] animate-fade-in"
      style={{ animationDelay: `${i * 40}ms` }}
    >
      <div className="w-10 h-10 flex items-center justify-center mb-4 border border-primary/25 text-primary">
        <f.icon className="h-4 w-4" />
      </div>
      <h3 className="font-display font-bold text-base mb-1">{f.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
    </div>
  );
}

export function CapabilitiesShowcase() {
  return (
    <section id="capabilities" className="container pb-32">
      <div className="max-w-3xl mx-auto text-center mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 web-panel mb-6">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Co všechno umíme
          </span>
        </div>
        <h2 className="font-display font-black text-4xl md:text-5xl mb-4">
          <span className="web-title-metal">
            Web + Discord Bot
          </span>
        </h2>
        <p className="text-muted-foreground text-lg">
          Kompletní ekosystém propojující komunitu, obsah a Discord na jednom místě.
        </p>
      </div>

      <div className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 flex items-center justify-center border border-primary/25 text-primary">
            <Globe className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-2xl">Webová platforma</h3>
          <div className="flex-1 h-px bg-border/60" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {webFeatures.map((f, i) => (
            <FeatureCard key={f.title} f={f} i={i} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 flex items-center justify-center border border-primary/25 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-2xl">Discord Bot</h3>
          <div className="flex-1 h-px bg-border/60" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {botFeatures.map((f, i) => (
            <FeatureCard key={f.title} f={f} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
