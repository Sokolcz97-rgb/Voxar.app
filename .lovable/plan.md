
# StudioVoxario Desktop — nativní Discord/TeamSpeak UI

Desktop aplikace dostane vlastní rozhraní `/app` (jen pro Electron shell), oddělené od webu. Web zůstává nedotčen.

## 1. Nový layout aplikace (`src/pages/app/`)

Klasický 4-sloupcový shell:

```text
┌──┬────────┬──────────────────────┬────────┐
│  │        │                      │        │
│G │Kanály  │  Chat / Voice room   │Členové │
│R │  #obec │                      │ online │
│A │  🔊 A  │                      │ idle   │
│I │  🔊 B  │                      │        │
│L │        │                      │        │
├──┴────────┴──────────────────────┴────────┤
│  [🎤 mute] [🎧 deafen] [⚙]  user@online   │
└───────────────────────────────────────────┘
```

Komponenty:
- `GuildRail` — ikony serverů vlevo (kruhy s iniciálami/logem, aktivní má pill indikátor)
- `ChannelSidebar` — hlavička serveru, seznam textových a hlasových kanálů, kolaps kategorie
- `ChatView` — zprávy v reálném čase, kompozer s Enter-to-send, typing indikátor, upload obrázků
- `VoiceView` — dlaždice účastníků s VU-metrem, avatarem, mute stavem, tlačítka Připojit/Odpojit/Sdílet obrazovku (share fáze 2)
- `MemberList` — presence groupy Online / Idle / DND / Offline, avatary, statusy
- `SelfPanel` — spodní bar s mikro/sluchátky/nastavení (styl Discord)
- `AppShell` — držel routing mezi kanály a stavy voice připojení

Vizuál: tmavá paleta (deep charcoal `#0e0f13`, panely `#151821`, akcent teal/cyan z existujícího brandu), zaoblené rohy 8px, jemný noise, ikony `lucide-react`. Vlastní scrollbary. Kompaktní hustota textu.

## 2. Datový model (nová migrace)

Nezávislý na existujících `servers`/`conversations` — desktop-only "voxguildy":

- `vox_guilds` — id, name, icon_url, owner_id, invite_code
- `vox_guild_members` — guild_id, user_id, nickname, role (owner/mod/member), joined_at
- `vox_channels` — id, guild_id, name, type (`text`|`voice`), position, category
- `vox_messages` — id, channel_id, author_id, content, attachments jsonb, created_at, edited_at
- `vox_voice_participants` — channel_id, user_id, session_id, joined_at, is_muted, is_deafened (přítomnost v místnosti)
- `vox_presence` — user_id, status (`online`|`idle`|`dnd`|`offline`), last_seen

Všechny s RLS: přístup jen členům guildy, publish do `supabase_realtime` pro `vox_messages`, `vox_voice_participants`, `vox_presence`. GRANTy podle pravidel.

## 3. WebRTC voice (peer-to-peer mesh)

- Signaling přes **Supabase Realtime broadcast** na kanálu `voice:{channel_id}`
- Klient publikuje `join`/`offer`/`answer`/`ice`/`leave` zprávy
- Každý účastník drží `RTCPeerConnection` s každým dalším (mesh, do ~8 lidí – dostačující)
- Zvuk: `getUserMedia({audio: {echoCancellation, noiseSuppression, autoGainControl}})`
- VU-metr přes `AudioContext` + `AnalyserNode`
- Push-to-talk (klávesa v nastavení) + toggle mute/deafen
- Reflex do `vox_voice_participants` pro seznam kdo v místnosti (i pro ostatní klienty které se právě dívají)

Fáze 2 (odloženo): sdílení obrazovky, video, TURN server (zatím jen public STUN `stun.l.google.com:19302` — funguje pro většinu sítí).

## 4. Presence

- Klient posílá heartbeat každých 30s do `vox_presence`
- Po 90s bez heartbeatu → automaticky offline (edge function / DB view s `now() - last_seen`)
- Ruční přepínač Online/Idle/DND ve `SelfPanel`

## 5. Electron integrace

- `electron/main.cjs`: při produkčním buildu načte `#/app` (hash routing), tj. hlavní okno je rovnou v aplikaci, nikoli na `/`
- Zachovat launcher, updater, tray tak jak jsou
- Přidat globální zkratky: `CmdOrCtrl+Shift+M` mute, PTT klávesa (konfigurovatelná)
- IPC pro nativní notifikace při zmínce / DM

## 6. Web zůstává

Web (`/`, `/desktop`, dashboard bota, formuláře atd.) se **nemění**. `/app` bude fungovat i v prohlížeči (pro testování), ale v navbaru se nepromuje — je to primárně desktop endpoint.

## Rozsah implementace v tomto kroku

Postavím kompletní MVP v jedné dodávce:
1. Migrace tabulek + RLS + realtime publikace
2. `AppShell` + `GuildRail` + `ChannelSidebar` + `MemberList` + `SelfPanel`
3. `ChatView` s realtime zprávami a uploadem
4. `VoiceView` s WebRTC mesh, mute/deafen, VU-metr
5. Presence heartbeat
6. CRUD guildy (vytvořit, invite code join) a kanálů (jen owner/mod)
7. Electron: bootovat rovnou do `/app`

**Není v tomto kroku:** screen share, video, TURN server, mobile parita, migrace existujících `servers`/`messages` do voxguild modelu, role-based permissions na kanály (jen owner/mod vs member), voice aktivita indikátor v seznamu členů (bude jen v místnosti).

Odhadovaná velikost: cca 15–20 nových souborů, 1 migrace, úprava `electron/main.cjs`. Souhlasíš s tímto rozsahem, nebo mám něco přidat/ubrat před stavbou?
