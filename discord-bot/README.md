# Discord bot (Fáze 3)

Externí Node.js bot, který se připojuje na Discord Gateway a čte konfiguraci z Lovable Cloud (Supabase). Doplňuje webové funkce o:

- **Auto-moderaci** (blokovaná slova, mentions, emoji, spam, NSFW)
- **Příkazy** s prefixem (`!ping`, `!help` + vlastní z `bot_commands`)
- **Uvítací zprávy** (`bot_welcome` → text/embed)
- **Ticket systém** (panel s tlačítkem, vytváří privátní kanál, transcript)
- **Odbavování fronty** `bot_outbound_queue` (zprávy z webu → kanál)
- **Heartbeat** každých 30 s do `bot_status` (status karta v dashboardu)

## Setup

1. **Discord Developer Portal** → vytvoř aplikaci → záložka *Bot* → *Reset Token* → zkopíruj.
2. V *Bot* zapni intenty:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
3. *OAuth2 → URL Generator*: scope `bot` + `applications.commands`, permissions: `Manage Channels`, `Manage Messages`, `Kick/Ban Members`, `Send Messages`, `Read Message History`, `Embed Links`. Otevři vygenerovanou URL a pozvi bota na server.

## Lokální spuštění

```bash
cd discord-bot
cp .env.example .env   # doplň DISCORD_TOKEN a SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

`SUPABASE_SERVICE_ROLE_KEY` najdeš v Lovable: **Cloud → Settings → API keys → service_role** (drž v tajnosti, nikdy do frontendu).

## Deploy (doporučené možnosti)

Bot potřebuje běžet **pořád** (WebSocket gateway). Edge funkce na to nestačí.

### Railway / Render / Fly.io (Docker)
```bash
docker build -t discord-bot .
docker run --env-file .env discord-bot
```
Na Railway nebo Render stačí pushnout složku `discord-bot/` jako vlastní repo a nastavit env proměnné v UI.

### VPS / Raspberry Pi (systemd)
```ini
# /etc/systemd/system/discord-bot.service
[Unit]
Description=Discord bot
After=network.target

[Service]
WorkingDirectory=/opt/discord-bot
EnvironmentFile=/opt/discord-bot/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
User=botuser

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now discord-bot
journalctl -u discord-bot -f
```

## Jak to drží pohromadě

- **Web** zapisuje konfiguraci do tabulek `bot_*` přes RLS (`can('bot','manage')`).
- **Bot** čte service-role klíčem (RLS obchází) — proto klíč **nikdy** nedávej do frontendu.
- **Web → bot**: ručně vystavená zpráva se zapíše do `bot_outbound_queue`; bot ji vyzvedne během ~5 s.
- **Bot → web**: každých 30 s zapisuje `bot_status` (počet serverů, verze, timestamp).

## Rozšíření

- Slash commands (`/...`) — stačí registrovat přes `REST` v `ready` hooku.
- Logování moderace do tabulky `moderation_log` (už existuje).
- Per-guild konfigurace — přidat sloupec `guild_id` do `bot_*` tabulek a filtrovat.
