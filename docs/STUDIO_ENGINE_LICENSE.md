# Licence a Upgrade pass – napojení aplikace (Voxario Studio Engine)

Prodej běží na webu StudioVoxario (repo `Voxar.app`, Supabase projekt `rioexuvgvmdwvidfakxy`).
Aplikace (engine) **nic neprodává ani neukládá** – jen se zeptá na stav licence a případně otevře
obchod v prohlížeči. Platby, potvrzení a vrácení řeší web.

## Model

- **Licence** – jednorázová, trvalá. V ceně jsou aktualizace na `license_updates_days` dní od koupě.
- **Upgrade pass** – měsíc (30 dní) / rok (365 dní). Prodlužuje aktualizace; navazuje na jejich konec
  (pokud už skončily, platí ode dne zaplacení).
- Po konci aktualizací **engine funguje dál** – jen nesmí stáhnout / nainstalovat verze vydané po
  `updates_until`.

## Identifikace produktu

V obchodě (Správa nabídky → položka Software → „Klíč produktu pro aplikaci“) má engine klíč,
doporučeně `voxario-studio-engine`. Engine si ho drží jako konstantu.

## Přihlášení

Engine potřebuje relaci uživatele StudioVoxario (Supabase Auth) – stejný účet jako na webu.
Možnosti: přihlášení e-mailem a heslem přes Supabase Auth, nebo předání relace z prohlížeče
(PKCE + 127.0.0.1 callback – stejný princip jako launcher Ashes of Eryon,
viz `supabase/functions/launcher-auth` a `src/pages/LauncherAuth.tsx`).

- URL: `https://rioexuvgvmdwvidfakxy.supabase.co`
- Veřejný (publishable) klíč: `sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-` (smí být v aplikaci)
- Žádný tajný klíč do aplikace nepatří.

## Stav licence

```
POST https://rioexuvgvmdwvidfakxy.supabase.co/rest/v1/rpc/shop_license_status
apikey: <publishable klíč>
Authorization: Bearer <access_token uživatele>
Content-Type: application/json

{ "p_product": "voxario-studio-engine" }
```

Odpověď:

```json
{
  "ok": true,
  "product": "voxario-studio-engine",
  "title": "Voxario Studio Engine",
  "owned": true,
  "purchased_at": "2026-11-02T10:00:00+00:00",
  "updates_until": "2027-11-02T10:00:00+00:00",
  "updates_active": true,
  "latest_version": "1.4.0",
  "latest_released_at": "2026-12-01T18:00:00+00:00",
  "latest_allowed": true,
  "pass_month_czk": 99,
  "pass_year_czk": 990,
  "buy_url": "https://studiovoxario.com/obchod?tab=software&licence=voxario-studio-engine",
  "pass_url": "https://studiovoxario.com/obchod?tab=software&pass=voxario-studio-engine"
}
```

Chyby: `{ "ok": false, "error": "not_signed_in" | "unknown_product" }`.

Doporučené chování enginu:

| Stav | Co dělat |
| --- | --- |
| `owned = false` | Zobrazit „Koupit licenci“ → otevřít `buy_url` v prohlížeči. Bez licence engine nespouštět (nebo demo režim). |
| `owned = true`, `updates_active = true` | Vše povoleno, nabízet aktualizace. |
| `owned = true`, `updates_active = false` | Engine normálně spustit. Upozornit „Aktualizace skončily `updates_until`“ a nabídnout **Upgrade pass** → `pass_url` (volitelně `&obdobi=mesic` / `&obdobi=rok`). |
| `latest_allowed = false` | Nenabízet stažení nejnovější verze (vyšla po konci aktualizací). |

Kontrolu stačí dělat při startu a jednou za pár hodin; výsledek si engine může krátce uložit
(např. 7 dní), aby fungoval i offline. Po zaplacení passu se stav změní do pár sekund
(platba kartou) nebo po ručním potvrzení převodu.

Pokud engine kontroluje verze sám, porovná datum vydání své nové verze s `updates_until`:
verze vydaná **po** `updates_until` vyžaduje Upgrade pass.

## Stažení instalátoru

Instalátor nahrává správce v obchodě k položce (soukromé úložiště `shop-files`). Stáhnout ho
smí jen uživatel s licencí, jejíž `updates_until` je pozdější než datum nahrání souboru
(`latest_allowed`). Stahování obstarává web (Obchod → Software).
