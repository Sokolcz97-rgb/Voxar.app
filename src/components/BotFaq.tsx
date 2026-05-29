import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Languages } from "lucide-react";

type Lang = "cs" | "en";

type FaqEntry = { q: string; a: string };

const FAQ: Record<Lang, { title: string; intro: string; sections: { id: string; title: string; items: FaqEntry[] }[] }> = {
  cs: {
    title: "FAQ — Jak používat bota",
    intro:
      "Tady najdeš návody ke každé záložce ve Správci bota. Pokud něco nefunguje, zkontroluj nejdřív, jestli je bot online (zelená tečka nahoře) a jestli máš na serveru správně nastavená oprávnění bota (Manage Channels, Ban Members, Manage Messages, View Audit Log).",
    sections: [
      {
        id: "basics",
        title: "Základ",
        items: [
          { q: "Co je „Konfigurace pro“ nahoře?", a: "Přepínač mezi globální (šablonovou) konfigurací a konkrétním Discord serverem. Změny v rámci serveru přepisují globální nastavení pouze pro daný server." },
          { q: "Prefix příkazů", a: "Znak před textovými příkazy, např. „!“ → „!ping“. Pokud necháš prázdné u serveru, použije se globální prefix." },
          { q: "Welcome / Log / Alerts kanál", a: "Vyber přímo textový kanál ze serveru. Welcome = uvítání nových členů, Log = záznam akcí bota, Alerts = upozornění na rizikové události (anti-scam, anti-bot)." },
          { q: "Maintenance — bot / web", a: "Když zapneš, bot oznámí údržbu v maintenance kanálu a přestane reagovat. „Web maintenance“ se týká i webu a je dostupný jen v globální konfiguraci." },
        ],
      },
      {
        id: "automod",
        title: "Auto-moderace",
        items: [
          { q: "Co bot blokuje automaticky?", a: "Vestavěný seznam vulgarismů (CZ + EN), rasistické nadávky a NSFW termíny. Detekce ignoruje diakritiku." },
          { q: "Další blokovaná slova", a: "Vlastní slova oddělená čárkou. Přidají se k vestavěnému seznamu." },
          { q: "Max mentions / emoji / spam práh", a: "Limit počtu @zmínek a emoji v jedné zprávě a počet zpráv za 5 sekund, po jehož překročení se spustí akce." },
          { q: "Akce při porušení", a: "Warn = jen varování, Delete = smaže zprávu, Mute / Kick / Ban = sankce na uživatele. Doporučeno: začít s Delete + Warn." },
          { q: "NSFW ochrana", a: "Detekuje explicitní obrázky. „Povolené NSFW kanály“ vyber přímo ze serveru — v nich detekce nezasahuje." },
          { q: "Anti-scam (nezobrazené nastavení)", a: "Bot automaticky maže phishingové odkazy (fake Nitro / Steam / krypto) a okamžitě banuje odesílatele bez varování. Důkaz se pošle do Alerts kanálu společně s odkazem na nahlášení Discordu." },
          { q: "Anti-bot ochrana", a: "Nový účet (<24 h), generický nick nebo neverifikovaný bot se logují do Alerts. Tvrdé případy se rovnou banují." },
        ],
      },
      {
        id: "commands",
        title: "Příkazy",
        items: [
          { q: "Jak přidat vlastní příkaz?", a: "Napiš jméno bez prefixu (např. „rules“), volitelný popis a text odpovědi. Bot pak reaguje na „!rules“." },
          { q: "Globální vs. serverový", a: "V globální konfiguraci platí na všech serverech, kde nemá server vlastní příkaz se stejným jménem." },
          { q: "Jak příkaz dočasně vypnout?", a: "Přepínačem u příkazu — nesmaže ho, jen ho deaktivuje." },
        ],
      },
      {
        id: "welcome",
        title: "Uvítací zprávy",
        items: [
          { q: "Jak nastavit uvítání?", a: "Vyber textový kanál ze serveru a napiš zprávu. Můžeš použít proměnné {user}, {server}, {memberCount}." },
          { q: "Lze mít víc uvítání?", a: "Ano — každé přidání vytvoří nový záznam. Bot pošle všechny zapnuté." },
        ],
      },
      {
        id: "embed",
        title: "Embed / Webhook",
        items: [
          { q: "Jak poslat embed?", a: "V záložce Embed vyber server a textový kanál, vyplň titulek, popis a barvu a klikni Odeslat. Bot pošle zprávu přímo. Webhook URL je jen pro pokročilé (přepíše bota)." },
          { q: "Markdown v popisu", a: "Funguje **tučně**, *kurzíva*, `kód` a odkazy [text](url)." },
          { q: "Embed pole", a: "Přidávej pole pro strukturovaný obsah. „Inline“ srovná pole vedle sebe (max 3 vedle sebe na šířku)." },
          { q: "JSON náhled", a: "Pod „Pokročilé“ vidíš výstupní JSON — užitečné pro debug nebo export." },
        ],
      },
      {
        id: "streams",
        title: "YT / Twitch",
        items: [
          { q: "Jak sledovat streamera?", a: "Vyber platformu, napiš handle (např. „shroud“ nebo URL) a vyber Discord kanál pro notifikace." },
          { q: "Proměnné v šabloně", a: "{handle}, {title}, {url}, {game}. Příklad: „🔴 {handle} právě vysílá: {title}“." },
          { q: "Webhook URL", a: "Volitelné — když není, použije se bot. Webhook umožní odesílat i bez bota na serveru." },
        ],
      },
      {
        id: "tickets",
        title: "Tickety",
        items: [
          { q: "Co je ticket panel?", a: "Zpráva v zvoleném kanálu s tlačítkem (nebo výběrem kategorie), přes které si uživatel otevře ticket." },
          { q: "Discord kategorie", a: "Kategorie, ve které se vytvoří soukromý kanál pro každý nový ticket." },
          { q: "Support role", a: "Role, která vidí všechny tickety. Mělo by ji mít support / moderátoři." },
          { q: "Režim panelu — tlačítko vs. kategorie", a: "Tlačítko = obecný ticket. Kategorie = uživatel si vybere typ (BUG, Dotaz, …) a každý typ může mít vlastní Discord kategorii." },
          { q: "Sync s webem", a: "Když zapneš, nové tickety / odpovědi se zrcadlí mezi webem a Discordem. Buď přes bota a sync kanál, nebo přes webhook URL." },
        ],
      },
      {
        id: "status",
        title: "Status checks",
        items: [
          { q: "Co to monitoruje?", a: "Bot pravidelně pinguje zadanou URL. Pokud spadne, pošle upozornění do vybraného Discord kanálu." },
          { q: "Webhook URL", a: "Volitelné — když je vyplněné, použije se místo bota (užitečné, když bot není na serveru)." },
        ],
      },
      {
        id: "serverstats",
        title: "Server Stats",
        items: [
          { q: "Co to dělá?", a: "Po zapnutí bot vytvoří v tvém Discord serveru kategorii nahoře a v ní hlasové kanály (max. 4), které ukazují statistiky — počet členů, online, status webu a status bota. Kanály jsou zamčené, nikdo do nich nemůže vstoupit, slouží jen jako vizuální štítek." },
          { q: "Jak nastavím vlastní názvy?", a: "U každého slotu vyber typ statistiky a uprav šablonu. Použij {value} jako místo, kam se doplní aktuální hodnota. Např.: „👥 Členové: {value}“." },
          { q: "Proč se hodnoty mění pomalu?", a: "Discord limituje přejmenování kanálů na ~2× za 10 minut, proto bot aktualizuje statistiky každých 10 minut." },
          { q: "Jaká oprávnění bot potřebuje?", a: "Manage Channels (Spravovat kanály), aby mohl vytvořit kategorii a kanály a přejmenovávat je." },
          { q: "Můžu mít méně než 4 statistiky?", a: "Ano — u nepotřebných slotů zvol „— vypnuto —“. Vytvoří se jen aktivní." },
          { q: "Status webu / bota – co to ukazuje?", a: "Web ukazuje UP nebo DOWN podle nastavení Údržba webu v sekci Základ. Bot ukazuje UP vždy, když běží (pokud spadne, hodnoty se prostě přestanou aktualizovat)." },
        ],
      },
      {
        id: "general",
        title: "Obecné / problémy",
        items: [
          { q: "Bot je offline", a: "Zelená tečka nahoře musí svítit. Pokud ne, počkej minutu nebo kontaktuj admina — bot se znovu připojí automaticky." },
          { q: "Bot nereaguje na konkrétním serveru", a: "Zkontroluj, jestli má bot pozvánku, oprávnění a jestli není zapnutá Maintenance." },
          { q: "Nemůžu vybrat kanál v dropdownu", a: "Server musí být schválený v „Servery bota“ a bot na něm musí být online. Při prvním načtení může trvat pár sekund, než se kanály stáhnou z Discordu." },
        ],
      },
    ],
  },
  en: {
    title: "FAQ — How to use the bot",
    intro:
      "Guides for every tab in the Bot Manager. If something doesn't work, first check the bot is online (green dot at the top) and has the right Discord permissions (Manage Channels, Ban Members, Manage Messages, View Audit Log).",
    sections: [
      {
        id: "basics",
        title: "Basics",
        items: [
          { q: "What is the “Configuration for” switch?", a: "Toggle between global (template) config and a specific Discord server. Per-server changes override the global defaults only for that server." },
          { q: "Command prefix", a: "The character before text commands, e.g. “!” → “!ping”. Leave blank on a server to use the global prefix." },
          { q: "Welcome / Log / Alerts channel", a: "Pick a text channel directly from your server. Welcome = greet new members, Log = bot actions, Alerts = risky events (anti-scam, anti-bot)." },
          { q: "Maintenance — bot / web", a: "When enabled, the bot announces maintenance in the maintenance channel and stops responding. “Web maintenance” affects the site and is only available in global config." },
        ],
      },
      {
        id: "automod",
        title: "Auto-moderation",
        items: [
          { q: "What does the bot block automatically?", a: "A built-in list of profanity (CZ + EN), racial slurs and NSFW terms. Detection ignores diacritics." },
          { q: "Extra blocked words", a: "Comma-separated custom words, added on top of the built-in list." },
          { q: "Max mentions / emojis / spam threshold", a: "Maximum @mentions and emojis per message, plus messages-per-5s threshold that triggers the action." },
          { q: "Action on violation", a: "Warn = warning only, Delete = remove message, Mute / Kick / Ban = user sanctions. Recommended: start with Delete + Warn." },
          { q: "NSFW protection", a: "Detects explicit images. Pick allowed NSFW channels from your server — detection skips them." },
          { q: "Anti-scam (silent)", a: "The bot auto-deletes phishing links (fake Nitro / Steam / crypto) and instantly bans the sender. Evidence is posted to the Alerts channel along with a Discord report link." },
          { q: "Anti-bot protection", a: "New accounts (<24 h), generic nicknames and unverified bots are logged to Alerts. Hard cases are banned right away." },
        ],
      },
      {
        id: "commands",
        title: "Commands",
        items: [
          { q: "How to add a custom command?", a: "Type a name without prefix (e.g. “rules”), optional description and a response. The bot will reply to “!rules”." },
          { q: "Global vs. per-server", a: "Global commands work on every server unless that server defines a command with the same name." },
          { q: "How to disable a command?", a: "Use the switch next to it — it stays in the list but is inactive." },
        ],
      },
      {
        id: "welcome",
        title: "Welcome messages",
        items: [
          { q: "How to set up welcome?", a: "Pick a text channel from your server and write the message. Use variables {user}, {server}, {memberCount}." },
          { q: "Multiple welcomes?", a: "Yes — every entry is sent. Disable individual rows with the toggle." },
        ],
      },
      {
        id: "embed",
        title: "Embed / Webhook",
        items: [
          { q: "How to send an embed?", a: "In the Embed tab pick the server and text channel, fill in title, description and color, then hit Send. Webhook URL is for advanced users only (overrides the bot)." },
          { q: "Markdown in description", a: "Use **bold**, *italic*, `code` and [text](url)." },
          { q: "Embed fields", a: "Add fields for structured content. “Inline” lines fields up next to each other (max 3 per row)." },
          { q: "JSON preview", a: "Under “Advanced” you can inspect the raw JSON — useful for debugging or exporting." },
        ],
      },
      {
        id: "streams",
        title: "YT / Twitch",
        items: [
          { q: "Track a streamer", a: "Pick the platform, type a handle (e.g. “shroud” or a URL) and choose the Discord channel for notifications." },
          { q: "Template variables", a: "{handle}, {title}, {url}, {game}. Example: “🔴 {handle} is live: {title}”." },
          { q: "Webhook URL", a: "Optional — when empty the bot is used. Webhook lets you post without the bot being on the server." },
        ],
      },
      {
        id: "tickets",
        title: "Tickets",
        items: [
          { q: "What is the ticket panel?", a: "A message in the chosen channel with a button (or category select) users click to open a ticket." },
          { q: "Discord category", a: "Category where the private channel for each new ticket is created." },
          { q: "Support role", a: "Role that can see all tickets — usually support / moderators." },
          { q: "Panel mode — button vs. categories", a: "Button = generic ticket. Categories = user picks a type (BUG, Question, …) and each type may have its own Discord category." },
          { q: "Web sync", a: "When enabled, new tickets / replies mirror between the web and Discord. Either via the bot + sync channel or via a webhook URL." },
        ],
      },
      {
        id: "status",
        title: "Status checks",
        items: [
          { q: "What does it monitor?", a: "The bot pings the given URL on schedule. If it goes down, an alert is posted to the chosen Discord channel." },
          { q: "Webhook URL", a: "Optional — used instead of the bot (handy if the bot isn't on the server)." },
        ],
      },
      {
        id: "serverstats",
        title: "Server Stats",
        items: [
          { q: "What does it do?", a: "When enabled, the bot creates a category at the top of your Discord server with up to 4 locked voice channels that display live stats — member count, online count, web status and bot status. Nobody can join them, they act as visual badges." },
          { q: "How do I customize names?", a: "For each slot pick a stat type and edit the template. Use {value} as a placeholder for the actual value, e.g. \"👥 Members: {value}\"." },
          { q: "Why are updates slow?", a: "Discord rate-limits channel renames to ~2 per 10 minutes, so the bot refreshes stats every 10 minutes." },
          { q: "Permissions required", a: "Manage Channels — so the bot can create the category, channels, and rename them." },
          { q: "Can I have fewer than 4 stats?", a: "Yes — set unused slots to \"— off —\". Only enabled ones are created." },
          { q: "What does Web / Bot status show?", a: "Web shows UP or DOWN based on the Web maintenance toggle in Basics. Bot shows UP whenever it's running (if it goes down, values simply stop updating)." },
        ],
      },
      {
        id: "general",
        title: "General / troubleshooting",
        items: [
          { q: "Bot is offline", a: "The green dot at the top must be on. If not, wait a minute or contact an admin — the bot reconnects automatically." },
          { q: "Bot ignores a server", a: "Check the bot is invited, has permissions, and Maintenance isn't enabled." },
          { q: "Channel dropdown is empty", a: "The server must be approved in “Bot servers” and the bot must be online. First load can take a few seconds to fetch channels from Discord." },
        ],
      },
    ],
  },
};

export function BotFaq() {
  const [lang, setLang] = useState<Lang>("cs");
  const data = FAQ[lang];
  return (
    <div className="space-y-4">
      <Card className="glass border-border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div>
            <h2 className="font-display text-2xl font-bold flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              {data.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{data.intro}</p>
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <Button
              size="sm"
              variant={lang === "cs" ? "default" : "ghost"}
              onClick={() => setLang("cs")}
              className="rounded-none"
            >
              🇨🇿 CZ
            </Button>
            <Button
              size="sm"
              variant={lang === "en" ? "default" : "ghost"}
              onClick={() => setLang("en")}
              className="rounded-none"
            >
              🇬🇧 EN
            </Button>
          </div>
        </div>
      </Card>

      {data.sections.map((sec) => (
        <Card key={sec.id} className="glass border-border p-6">
          <h3 className="font-display text-lg font-bold mb-3">{sec.title}</h3>
          <Accordion type="multiple" className="w-full">
            {sec.items.map((it, i) => (
              <AccordionItem key={i} value={`${sec.id}-${i}`}>
                <AccordionTrigger className="text-sm text-left">{it.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {it.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      ))}
    </div>
  );
}
