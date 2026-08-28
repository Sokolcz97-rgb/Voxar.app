import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Search, Sparkles, Wrench, ShieldCheck, Rocket, Newspaper } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { SEO } from "@/components/SEO";
import { CHANGELOG, type ChangelogType } from "@/data/changelog";

const TYPE_META: Record<ChangelogType, { icon: typeof Sparkles; cs: string; en: string; className: string }> = {
  feature: { icon: Rocket, cs: "Novinka", en: "Feature", className: "bg-primary/15 text-primary border-primary/40" },
  improvement: { icon: Sparkles, cs: "Vylepšení", en: "Improvement", className: "bg-accent/15 text-accent border-accent/40" },
  fix: { icon: Wrench, cs: "Oprava", en: "Fix", className: "bg-muted text-muted-foreground border-border" },
  security: { icon: ShieldCheck, cs: "Bezpečnost", en: "Security", className: "bg-destructive/15 text-destructive border-destructive/40" },
};

const Novinky = () => {
  const { i18n } = useTranslation();
  const cs = i18n.language === "cs";
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | ChangelogType>("all");

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(cs ? "cs-CZ" : "en-US", {
      day: "numeric", month: "long", year: "numeric",
    });

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CHANGELOG.map((e) => {
      const changes = e.changes.filter((c) => {
        if (type !== "all" && c.type !== type) return false;
        if (!q) return true;
        const hay = `${e.version} ${e.title} ${e.titleEn ?? ""} ${c.text} ${c.textEn ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
      return { ...e, changes };
    }).filter((e) => e.changes.length > 0);
  }, [search, type]);

  const totalChanges = CHANGELOG.reduce((n, e) => n + e.changes.length, 0);

  const title = cs ? "Changelog aplikace" : "Application changelog";
  const desc = cs
    ? "Přehled všech úprav, oprav a novinek ve StudioVoxario webu i desktop aplikaci Voxar.app."
    : "All updates, fixes and new features in the StudioVoxario web and Voxar.app desktop client.";

  return (
    <div className="min-h-screen relative">
      <SEO
        title={title}
        description={desc}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description: desc,
          url: "https://studiovoxario.com/novinky",
        }}
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in max-w-4xl">
        <PageHero
          eyebrow={cs ? "Novinky" : "Changelog"}
          title={title}
          icon={Newspaper}
          description={
            <>
              {cs
                ? "Co se změnilo v aplikaci — každá úprava, oprava i bezpečnostní zásah."
                : "What changed in the app — every update, fix and security hardening."}
              <br />
              <span className="text-foreground/70">
                {cs
                  ? `${CHANGELOG.length} verzí · ${totalChanges} záznamů`
                  : `${CHANGELOG.length} versions · ${totalChanges} entries`}
              </span>
            </>
          }
        />

        <Card className="glass border-border p-4 mb-6">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={cs ? "Hledat v changelogu…" : "Search the changelog…"}
                className="pl-9"
              />
            </div>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{cs ? "Všechny typy" : "All types"}</SelectItem>
                {(Object.keys(TYPE_META) as ChangelogType[]).map((k) => (
                  <SelectItem key={k} value={k}>{cs ? TYPE_META[k].cs : TYPE_META[k].en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {entries.length === 0 ? (
          <Card className="glass border-border p-10 text-center">
            <p className="text-muted-foreground">
              {cs ? "Žádný záznam neodpovídá filtru." : "No entry matches the filter."}
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {entries.map((e) => (
              <Card key={e.version} className="glass border-border p-5">
                <div className="flex flex-wrap items-baseline gap-3 mb-4">
                  <h2 className="font-display font-black text-2xl text-glow">{e.version}</h2>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {fmtDate(e.date)}
                  </span>
                  <span className="text-sm text-foreground/80">
                    {cs ? e.title : e.titleEn ?? e.title}
                  </span>
                </div>
                <ul className="space-y-3">
                  {e.changes.map((c, i) => {
                    const meta = TYPE_META[c.type];
                    const Icon = meta.icon;
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <Badge variant="outline" className={`shrink-0 gap-1 ${meta.className}`}>
                          <Icon className="h-3 w-3" />
                          {cs ? meta.cs : meta.en}
                        </Badge>
                        <span className="text-sm leading-relaxed">
                          {cs ? c.text : c.textEn ?? c.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Novinky;
