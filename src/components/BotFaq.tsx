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
        id: "points",
        title: "Bodový systém (voice)",
        items: [
          { q: "Jak body fungují?", a: "Bot počítá čas členů v hlasových kanálech. Výchozí poměr je 1 bod = 10 minut ve voice (nastavitelné). Body se ukládají per server, nikoliv globálně." },
          { q: "Jak se počítá čas?", a: "Bot startuje session při vstupu do voice a ukončuje ji při odchodu (nebo změně kanálu / muteu / deafenu, pokud máš tyto stavy nastavené jako ignorované). Každých 5 min se dělá průběžný checkpoint, aby dlouhé pobyty ve voice nestály na jednom balíku." },
          { q: "Jak nastavím oznámení o milnících?", a: "Zvol „Goal kanál“ a doplň seznam milníků (např. „10, 100, 1000“). Když někdo hodnotu překročí, bot pošle zprávu podle šablony. Volitelně nastav „Opakovaný milník po X bodech“ — pak bot hlásí i každé násobky (např. 100, 200, 300…)." },
          { q: "Můžu body ručně upravit (event, soutěž)?", a: "Ano. V panelu je karta „Ruční úprava bodů“ — zadej Discord ID uživatele a přidej / odeber / nastav / vynuluj body. Změny se zapisují do auditu (bot_points_log). To samé jde ze samotného Discordu příkazy /body add|remove|set|reset (Manage Server)." },
          { q: "Jak si uživatel zobrazí své body?", a: "Napíše /body me. Pro cizí body /body user @jméno. Top 10 přes /body top. Konfiguraci ukáže /body config." },
          { q: "Ignorovat mute / deafen / AFK", a: "Standardně bot nepočítá čas, když je uživatel mutovaný / deafenovaný nebo v AFK kanálu. Přepínače v panelu ti dovolí toto chování změnit." },
          { q: "Minimum lidí v kanálu", a: "Aby se body nesbíraly samotou, nastav např. 2 — čas se počítá jen když je v kanálu aspoň tolik lidí (kontrola se dělá při vstupu)." },
          { q: "Bonus role × násobitel", a: "Vyber role, které dostávají násobené body (např. Booster × 2). Násobič se aplikuje při zápisu — retroaktivně se staré body nepřepočítávají." },
          { q: "Kdy se změny projeví?", a: "Bot cachuje konfiguraci 30 sekund, takže po uložení počkej krátkou chvíli." },
          { q: "Jaká oprávnění bot potřebuje?", a: "„Connect“ + „View Channels“ pro sledování voice stavů. Pro oznámení milníků potřebuje „Send Messages“ v goal kanálu. Pokud nechceš, aby bot fyzicky připojoval do voice, není potřeba — sleduje jen stavy, nepřipojuje se." },
        ],
      },
      {
        id: "games-minecraft",
        title: "Games → Minecraft",
        items: [
          { q: "Co Minecraft integrace umí?", a: "Propojí Minecraft server s Discord serverem: přeposílá chat oběma směry, oznamuje join/leave/úmrtí/achievementy, umí propojit MC účet s Discord účtem (a přiřadit roli), a volitelně ukazuje status serveru." },
          { q: "Jaké pluginy jsou podporované?", a: "Doporučené je DiscordSRV (nejrozšířenější, Paper/Spigot). Podporujeme i DiscordIntegration a DSB. Pro cokoliv jiného (Fabric, Velocity, vlastní backend) je k dispozici REST bridge — plugin nebo mod volá naši HTTP endpoint." },
          { q: "Jak nastavím DiscordSRV?", a: "1) V dashboardu (Games → Minecraft) zapni integraci, vyber typ „DiscordSRV“, přiřaď kanály (chat, join/leave, úmrtí, achievementy). 2) Ulož a zkopíruj Plugin token z karty „REST bridge“. 3) V DiscordSRV configu na serveru nastav webhook / bridge na náš endpoint a vlož token do hlavičky x-mc-token. 4) Kanály v DiscordSRV configu spáruj se stejnými Discord ID, které jsi zvolil v dashboardu." },
          { q: "Jak funguje REST bridge (vlastní plugin/mod)?", a: "POST na endpoint (URL najdeš v panelu) s hlavičkou x-mc-token a JSON: {action, name, uuid, message}. Akce: chat, join, leave, death, achievement, server_status, verify_link. Bot pak zprávu odešle do odpovídajícího Discord kanálu." },
          { q: "Jak propojím svůj MC účet s Discordem?", a: "1) V panelu klikni na „Vygenerovat kód“ (platí 15 minut). 2) Přihlaš se na MC server. 3) Napiš do chatu /discord link KÓD (nebo ekvivalent u tvého pluginu). 4) Plugin pošle na bridge verify_link s tvým UUID + kódem a propojení se uloží. Pokud máš nastavenou „Roli po propojení“, bot ti ji přiřadí automaticky." },
          { q: "Chat neprochází z MC do Discordu", a: "Zkontroluj: integrace je zapnutá, plugin token je aktuální (mohl být rotován), v dashboardu je zvolen „Chat“ kanál, přepínač „Chat MC → Discord“ je zapnutý a plugin skutečně volá endpoint (v pluginu si zapni debug log)." },
          { q: "Chat neprochází z Discordu do MC", a: "Přepínač „Chat Discord → MC“ musí být zapnutý. Bot označí zprávy z chat kanálu a plugin si je vyzvedne (u DiscordSRV to dělá plugin sám; u REST bridge zatím pull endpoint jen vrací prázdné pole)." },
          { q: "Rotace tokenu", a: "Tlačítko ↻ vedle tokenu vygeneruje nový. Starý okamžitě přestane fungovat — nezapomeň nový vložit do configu pluginu." },
          { q: "Bezpečnost", a: "Token nikdy nesdílej veřejně (funguje jako heslo). Endpoint je HTTPS, komunikace probíhá jen s naším backendem — plugin nemá přístup k žádným jiným datům než k tomu, co si sám pošle." },
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
        id: "points",
        title: "Voice points",
        items: [
          { q: "How do points work?", a: "The bot tracks how long members stay in voice channels. Default rate is 1 point per 10 minutes (configurable). Points are stored per server, not globally." },
          { q: "How is time counted?", a: "A session starts when a user joins voice and ends when they leave / switch channel / go mute / go deaf (if you flagged those as ignored). A checkpoint runs every 5 minutes so long sessions get credited progressively." },
          { q: "Milestone announcements", a: "Pick a goal channel and a list of milestones (e.g. \"10, 100, 1000\"). When a user crosses one, the bot posts using your template. You can also set \"Repeat every X points\" for periodic milestones (every 100, 200…)." },
          { q: "Manual adjustments (events, contests)", a: "Use the \"Manual point adjustment\" card — enter the user's Discord ID and add / remove / set / reset. Everything is audit-logged. Same actions from Discord: /body add|remove|set|reset (Manage Server)." },
          { q: "How does a user see their own points?", a: "/body me for own. /body user @name for someone else. /body top for the top 10. /body config for the current setup." },
          { q: "Ignore mute / deafen / AFK", a: "By default the bot skips time when the user is muted, deafened or in the AFK channel. Switches in the panel let you change this." },
          { q: "Minimum members in channel", a: "So people can't farm alone, set e.g. 2 — time counts only when at least that many people are in the channel (checked at session start)." },
          { q: "Bonus roles × multiplier", a: "Pick roles that receive multiplied points (e.g. Booster × 2). Multiplier is applied at write time — old points aren't retroactively rescaled." },
          { q: "When do config changes apply?", a: "The bot caches configuration for 30 seconds, so wait a moment after saving." },
          { q: "Permissions", a: "\"Connect\" + \"View Channels\" to observe voice states. \"Send Messages\" in the goal channel for milestone posts. The bot does NOT need to join voice — it only watches state." },
        ],
      },
      {
        id: "games-minecraft",
        title: "Games → Minecraft",
        items: [
          { q: "What does the Minecraft integration do?", a: "It bridges your Minecraft server with Discord: two-way chat relay, join/leave/death/achievement announcements, Minecraft ↔ Discord account linking (with optional role assignment) and optional server-status messages." },
          { q: "Which plugins are supported?", a: "Recommended is DiscordSRV (most common, Paper/Spigot). We also support DiscordIntegration and DSB. For anything else (Fabric, Velocity, custom) use the REST bridge — the plugin/mod calls our HTTP endpoint." },
          { q: "How to set up DiscordSRV", a: "1) In the dashboard (Games → Minecraft) enable the integration, pick type “DiscordSRV”, assign channels. 2) Save and copy the Plugin token from the “REST bridge” card. 3) In DiscordSRV config point the bridge/webhook at our endpoint and place the token in the x-mc-token header. 4) Map DiscordSRV channel IDs to the same Discord IDs you chose in the dashboard." },
          { q: "How does the REST bridge work?", a: "POST to the endpoint shown in the panel with header x-mc-token and JSON: {action, name, uuid, message}. Actions: chat, join, leave, death, achievement, server_status, verify_link. The bot then sends the message to the matching Discord channel." },
          { q: "How to link my MC account to Discord", a: "1) Click “Generate code” in the panel (valid 15 min). 2) Join the MC server. 3) Type /discord link CODE in game (or your plugin's equivalent). 4) The plugin sends verify_link with your UUID + code, the link is saved, and if you configured a “link role” the bot assigns it automatically." },
          { q: "Chat doesn't reach Discord", a: "Check: integration enabled, plugin token current (may have been rotated), Chat channel selected, “Chat MC → Discord” switch on, and that the plugin is actually calling the endpoint (enable plugin debug logs)." },
          { q: "Chat doesn't reach Minecraft", a: "The “Chat Discord → MC” switch must be on. The bot picks up messages from the chat channel and the plugin pulls them (DiscordSRV handles this itself; for REST bridge the pull endpoint currently returns an empty list)." },
          { q: "Token rotation", a: "The ↻ button next to the token generates a new one. The old one stops working immediately — paste the new value into your plugin config." },
          { q: "Security", a: "Never share the token publicly (it acts as a password). The endpoint is HTTPS and only talks to our backend — the plugin has no access to anything beyond what it sends itself." },
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
