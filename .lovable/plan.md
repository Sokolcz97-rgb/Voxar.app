## Architektura

Discord bot vyžaduje trvalé WebSocket spojení (Discord Gateway), což **Lovable Cloud edge funkce nepodporují** (jsou stateless / krátkodobé). Řešení:

```text
┌─────────────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Web (Dashboard)    │ ──RW──▶ │  Lovable Cloud   │ ◀──RW── │  Bot (Node) │
│  /dashboard/bot     │         │  DB + Edge fcí   │         │  externě    │
└─────────────────────┘         └──────────────────┘         └─────┬───────┘
                                          ▲                        │
                                  webhooky (YT/Twitch              ▼
                                   notifikace, status)      Discord Gateway
```

- **Web** = UI v `/dashboard` (a podstránka `/dashboard/bot`) pro nastavení.
- **DB** = uloží prefix, token (šifrovaně jako secret), kanály, vlastní příkazy, uvítací zprávy, embedy, ticket nastavení, NSFW pravidla, sledované YT/Twitch kanály.
- **Bot** = samostatný Node.js projekt (discord.js), který si načte konfiguraci z DB a reaguje. Tenhle kód **nepatří do Lovable projektu** — dodám ho jako zvláštní repo / složku k nasazení mimo Lovable.
- **Edge funkce** v Lovable Cloud zvládnou: cron na Twitch/YouTube polling → zápis do `bot_outbound_queue` → bot to přečte a pošle na Discord; přijímání webhooků z discohook source; přepínání "maintenance" módu (bot/web).

## Co bude na dashboardu (`/dashboard` karta + `/dashboard/bot`)

1. **Status bota** — online/offline (heartbeat z bota do `bot_status` tabulky), verze, počet serverů.
2. **Základ** — prefix, bot token (uložen přes secret tool, ne v DB plain), default kanály (welcome, log, alerts).
3. **Auto-moderace** — toggle, blokovaná slova (list), max emoji, max mentions, anti-spam práh, akce (warn/mute/kick/ban), NSFW protection toggle + kanály.
4. **Příkazy** — seznam vestavěných (toggle on/off) + CRUD vlastních (`!název` → odpověď text/embed JSON).
5. **Uvítací zprávy** — kanál, text nebo embed (JSON editor + náhled), proměnné `{user}`, `{server}`.
6. **Embed builder + webhook** — formulář pro embed (title/desc/color/fields/image) s importem z discohook URL/JSON, odeslání přes webhook URL na vybraný kanál.
7. **YouTube / Twitch notifikace** — přidat kanál (handle už máš v profilu), cílový Discord kanál, šablona zprávy. Cron edge function `notify-streams` poolne každých 5 min (Twitch už máš), nové = zápis do outbound queue → bot pošle.
8. **Ticket systém** — kategorie, support role, uvítací zpráva ticketu (markdown), transcript on close.
9. **Server/web status** — periodická kontrola (Lovable preview URL + tvoje servery z `servers` tabulky), v případě výpadku → zpráva do zvoleného kanálu. Toggle "maintenance" (web/bot) → bot pošle oznámení.

## Databázové změny (jeden migration)

Nové tabulky (všechny s RLS přes `can('bot','manage')` permission):
- `bot_config` (singleton) — prefix, default kanály, auto-mod nastavení (JSONB), NSFW, status, maintenance flagy.
- `bot_commands` — name, response_type (text/embed), content (JSONB), enabled.
- `bot_welcome` — channel_id, content/embed JSON, enabled.
- `bot_stream_notifications` — platform, handle, discord_channel_id, template, last_notified_at.
- `bot_tickets_config` — category_id, support_role_id, welcome_md, transcripts toggle.
- `bot_status_checks` — target (url/server_id), discord_channel_id, last_status, last_changed_at.
- `bot_outbound_queue` — id, channel_id, payload JSONB, sent_at — fronta pro odchozí zprávy z webu/edge.
- `bot_status` (singleton) — last_heartbeat, version, guild_count (zapisuje bot).

Nové permission: `bot:manage`, `bot:view`.

## Edge funkce

- `bot-poll-streams` (cron 5 min) — Twitch/YouTube → outbound queue.
- `bot-check-status` (cron 2 min) — ping web + servery → queue + update `bot_status_checks`.
- `bot-send` — manuální odeslání embedu/zprávy z webu (zapíše do queue).

## Externí bot (mimo Lovable)

Samostatný `discord-bot/` projekt (Node + discord.js + @supabase/supabase-js se service role klíčem):
- subscribe na realtime kanál `bot_outbound_queue` → pošle a smaže.
- listener na Discord events: message → auto-mod check; guildMemberAdd → welcome; reaction na ticket panel → vytvoří kanál.
- každých 30s heartbeat do `bot_status`.
- Dodám jako ZIP / instrukce pro nasazení na Railway/Fly.io s `DISCORD_TOKEN` + `SUPABASE_SERVICE_ROLE_KEY`.

## Frontend

- `src/pages/DashboardBot.tsx` — taby (Status, Základ, Auto-mod, Příkazy, Welcome, Embed, Notifikace, Tickety, Status checks).
- Karta na `src/pages/Dashboard.tsx` s rychlým přehledem (bot online/offline, počet příkazů, počet notifikací) + tlačítko "Spravovat bota".
- Route `/dashboard/bot` chráněná `requireEditor` + `can('bot','manage')`.

## Co potřebuju potvrdit, než začnu

1. **OK s tím, že bot poběží externě?** (Lovable to fakt nezvládne — žádný hosting Node procesu.) Pokud ano, dodám kód bota a návod nasazení.
2. **Discohook source** — myslíš import JSON z https://discohook.org? (uložím parser pro jejich formát).
3. **Rozsah teď** — uděláme to celé v jednom kroku, nebo postupně? Doporučuju fáze:
   - **Fáze 1**: DB + dashboard karta + UI pro základ, příkazy, welcome, embed/webhook (funguje hned, bez bota — webhooky posílá přímo edge funkce).
   - **Fáze 2**: Stream notifikace + status checky (edge cron, taky bez bota).
   - **Fáze 3**: Externí bot pro auto-mod, tickety, gateway eventy.
