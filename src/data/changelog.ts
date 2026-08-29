export type ChangelogType = "feature" | "fix" | "improvement" | "security";

export type ChangelogEntry = {
  version: string;
  date: string; // ISO date
  title: string;
  titleEn?: string;
  changes: { type: ChangelogType; text: string; textEn?: string }[];
};

/**
 * Changelog aplikace StudioVoxario / Voxar.app.
 * Nové záznamy se přidávají na začátek pole při každé úpravě nebo opravě.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.0.12-alpha",
    date: "2026-08-29",
    title: "Oprava přihlášení v desktop aplikaci",
    titleEn: "Desktop app sign-in fix",
    changes: [
      {
        type: "fix",
        text: "Přihlášení přes Google (a další poskytovatele) se nyní otevře přímo v aplikaci místo prohlížeče, takže se účet skutečně přihlásí.",
        textEn: "Google (and other provider) sign-in now opens inside the app instead of the browser, so the account is actually signed in.",
      },
      {
        type: "fix",
        text: "Aplikace při startu maže HTTP cache, takže vždy načte aktuální verzi a nezobrazuje staré přihlašovací okno.",
        textEn: "The app clears its HTTP cache on start so it always loads the current version instead of an outdated sign-in screen.",
      },
    ],
  },
  {
    version: "0.0.11-alpha",
    date: "2026-08-28",
    title: "Novinky = changelog aplikace",
    titleEn: "News page is now the app changelog",
    changes: [
      {
        type: "feature",
        text: "Stránka Novinky nově zobrazuje changelog aplikace místo herních vydání.",
        textEn: "The News page now shows the app changelog instead of game releases.",
      },
      {
        type: "improvement",
        text: "Odstraněno tahání her z IGDB, CheapSharku a Steamu včetně administrace synchronizace.",
        textEn: "Removed IGDB, CheapShark and Steam release syncing along with its admin page.",
      },
    ],
  },
  {
    version: "0.0.10-alpha",
    date: "2026-08-27",
    title: "Vývojářské nástroje a LFG",
    titleEn: "Developer tools and LFG",
    changes: [
      {
        type: "feature",
        text: "Vývojářské nástroje v nastavení aplikace: správa her, LFG matchmaking a vysílací nástroje (Twitch, YouTube, Kick).",
        textEn: "Developer tools in app settings: game catalog, LFG matchmaking and broadcasting tools (Twitch, YouTube, Kick).",
      },
      {
        type: "fix",
        text: "LFG upozornění se nyní doručují v reálném čase online hráčům.",
        textEn: "LFG alerts are now delivered to online players in real time.",
      },
      {
        type: "security",
        text: "Platební údaje obchodu jsou přístupné pouze adminům, veřejně jen nutné minimum.",
        textEn: "Shop payment details are admin-only; buyers see only the minimum required data.",
      },
    ],
  },
  {
    version: "0.0.9-alpha",
    date: "2026-08-20",
    title: "Aktualizace aplikace a HUD vzhled",
    titleEn: "App updater and HUD look",
    changes: [
      {
        type: "feature",
        text: "Systémové upozornění na novou verzi s jedním klikem pro restart a načtení nových assetů.",
        textEn: "System update alert with one-click reload of the newest assets.",
      },
      {
        type: "improvement",
        text: "Sjednocený tmavý sci-fi HUD vzhled napříč webem i desktop aplikací.",
        textEn: "Unified dark sci-fi HUD styling across web and desktop app.",
      },
    ],
  },
];
